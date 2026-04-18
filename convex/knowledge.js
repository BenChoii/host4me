/**
 * Alfred's Brain — Knowledge Graph
 *
 * Convex functions for the knowledge graph that powers Alfred's long-term memory.
 * Nodes represent knowledge (properties, guests, issues, patterns, etc.)
 * Edges represent relationships between them.
 *
 * Public queries are authenticated via getAuthUserId -> tenant lookup.
 * Internal mutations are called by agent flows (scraper, chat handler, etc.)
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// --- Helpers ---

async function getTenantForUser(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return ctx.db
    .query("tenants")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// --- Public Queries (Dashboard) ---

/**
 * Get the full knowledge graph for the current tenant.
 * Returns all non-archived nodes and all edges connecting them.
 */
export const getGraph = query({
  args: {},
  handler: async (ctx) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) return { nodes: [], edges: [], feed: [] };

    const allNodes = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const nodes = allNodes.filter((n) => !n.archived);
    const nodeIds = new Set(nodes.map((n) => n._id));

    const allEdges = await ctx.db
      .query("knowledgeEdges")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const edges = allEdges.filter(
      (e) => nodeIds.has(e.sourceNode) && nodeIds.has(e.targetNode)
    );

    const feed = await ctx.db
      .query("knowledgeFeed")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(20);

    return { nodes, edges, feed };
  },
});

export const getNodeDetail = query({
  args: { nodeId: v.id("knowledgeNodes") },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) return null;

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.tenantId !== tenant._id) return null;

    const outEdges = await ctx.db
      .query("knowledgeEdges")
      .withIndex("by_source", (q) => q.eq("sourceNode", args.nodeId))
      .collect();

    const inEdges = await ctx.db
      .query("knowledgeEdges")
      .withIndex("by_target", (q) => q.eq("targetNode", args.nodeId))
      .collect();

    const connectedIds = new Set();
    const connections = [];

    for (const edge of outEdges) {
      if (!connectedIds.has(edge.targetNode)) {
        connectedIds.add(edge.targetNode);
        const target = await ctx.db.get(edge.targetNode);
        if (target && !target.archived) {
          connections.push({
            node: target,
            relationship: edge.relationship,
            direction: "outgoing",
            strength: edge.strength,
          });
        }
      }
    }

    for (const edge of inEdges) {
      if (!connectedIds.has(edge.sourceNode)) {
        connectedIds.add(edge.sourceNode);
        const source = await ctx.db.get(edge.sourceNode);
        if (source && !source.archived) {
          connections.push({
            node: source,
            relationship: edge.relationship,
            direction: "incoming",
            strength: edge.strength,
          });
        }
      }
    }

    return { node, connections };
  },
});

export const search = query({
  args: {
    query: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) return [];

    if (!args.query.trim()) return [];

    let searchQuery = ctx.db
      .query("knowledgeNodes")
      .withSearchIndex("search_content", (q) => {
        let sq = q.search("content", args.query).eq("tenantId", tenant._id);
        if (args.type) {
          sq = sq.eq("type", args.type);
        }
        return sq;
      });

    const results = await searchQuery.take(20);
    return results.filter((n) => !n.archived);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) return { nodeCount: 0, edgeCount: 0, learnedToday: 0, topTypes: [] };

    const nodes = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const activeNodes = nodes.filter((n) => !n.archived);

    const edges = await ctx.db
      .query("knowledgeEdges")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const learnedToday = activeNodes.filter(
      (n) => n._creationTime >= todayStart.getTime()
    ).length;

    const typeCounts = {};
    for (const n of activeNodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }

    return {
      nodeCount: activeNodes.length,
      edgeCount: edges.length,
      learnedToday,
      typeCounts,
    };
  },
});

// --- Public Mutations (User editing knowledge) ---

export const confirmNode = mutation({
  args: { nodeId: v.id("knowledgeNodes") },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) throw new Error("Not authenticated");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.tenantId !== tenant._id) throw new Error("Node not found");

    await ctx.db.patch(args.nodeId, {
      confidence: 1.0,
      lastConfirmedAt: Date.now(),
      source: "user_input",
    });

    await ctx.db.insert("knowledgeFeed", {
      tenantId: tenant._id,
      action: "confirmed",
      nodeId: args.nodeId,
      summary: `Confirmed: "${node.name}" -- confidence set to 100%`,
    });
  },
});

export const editNode = mutation({
  args: {
    nodeId: v.id("knowledgeNodes"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) throw new Error("Not authenticated");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.tenantId !== tenant._id) throw new Error("Node not found");

    const updates = {
      confidence: 1.0,
      lastConfirmedAt: Date.now(),
      source: "user_input",
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.content !== undefined) updates.content = args.content;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(args.nodeId, updates);

    await ctx.db.insert("knowledgeFeed", {
      tenantId: tenant._id,
      action: "updated",
      nodeId: args.nodeId,
      summary: `Updated: "${args.name || node.name}" -- user correction applied`,
    });
  },
});

export const archiveNode = mutation({
  args: { nodeId: v.id("knowledgeNodes") },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) throw new Error("Not authenticated");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.tenantId !== tenant._id) throw new Error("Node not found");

    await ctx.db.patch(args.nodeId, { archived: true });

    await ctx.db.insert("knowledgeFeed", {
      tenantId: tenant._id,
      action: "archived",
      nodeId: args.nodeId,
      summary: `Archived: "${node.name}"`,
    });
  },
});

export const addNode = mutation({
  args: {
    type: v.string(),
    name: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    connectTo: v.optional(v.array(v.object({
      nodeId: v.id("knowledgeNodes"),
      relationship: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const tenant = await getTenantForUser(ctx);
    if (!tenant) throw new Error("Not authenticated");

    const nodeId = await ctx.db.insert("knowledgeNodes", {
      tenantId: tenant._id,
      type: args.type,
      name: args.name,
      content: args.content,
      confidence: 1.0,
      source: "user_input",
      tags: args.tags || [],
      lastConfirmedAt: Date.now(),
      accessCount: 0,
      archived: false,
    });

    if (args.connectTo) {
      for (const conn of args.connectTo) {
        await ctx.db.insert("knowledgeEdges", {
          tenantId: tenant._id,
          sourceNode: nodeId,
          targetNode: conn.nodeId,
          relationship: conn.relationship,
          strength: 1.0,
        });
      }
    }

    await ctx.db.insert("knowledgeFeed", {
      tenantId: tenant._id,
      action: "created",
      nodeId,
      summary: `Added: "${args.name}" -- user-created knowledge`,
    });

    return nodeId;
  },
});

// --- Internal Mutations (Called by Agent Flows) ---

export const learnFact = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    type: v.string(),
    name: v.string(),
    content: v.string(),
    confidence: v.number(),
    source: v.string(),
    sourceRef: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    connections: v.optional(
      v.array(
        v.object({
          targetNodeId: v.optional(v.id("knowledgeNodes")),
          targetName: v.optional(v.string()),
          targetType: v.optional(v.string()),
          relationship: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("type", args.type)
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    let nodeId;

    if (existing) {
      if (args.confidence >= existing.confidence) {
        await ctx.db.patch(existing._id, {
          content: args.content,
          confidence: Math.min(1.0, Math.max(existing.confidence, args.confidence)),
          source: args.source,
          sourceRef: args.sourceRef,
          lastConfirmedAt: Date.now(),
          tags: args.tags || existing.tags,
          accessCount: existing.accessCount + 1,
        });
      } else {
        await ctx.db.patch(existing._id, {
          lastConfirmedAt: Date.now(),
          accessCount: existing.accessCount + 1,
        });
      }
      nodeId = existing._id;

      await ctx.db.insert("knowledgeFeed", {
        tenantId: args.tenantId,
        action: "updated",
        nodeId,
        summary: `Updated: "${args.name}" -- ${args.source}`,
      });
    } else {
      nodeId = await ctx.db.insert("knowledgeNodes", {
        tenantId: args.tenantId,
        type: args.type,
        name: args.name,
        content: args.content,
        confidence: args.confidence,
        source: args.source,
        sourceRef: args.sourceRef,
        tags: args.tags || [],
        lastConfirmedAt: Date.now(),
        accessCount: 0,
        archived: false,
      });

      await ctx.db.insert("knowledgeFeed", {
        tenantId: args.tenantId,
        action: "created",
        nodeId,
        summary: `Learned: "${args.name}" -- ${args.source}`,
      });
    }

    if (args.connections) {
      for (const conn of args.connections) {
        let targetId = conn.targetNodeId;

        if (!targetId && conn.targetName && conn.targetType) {
          const target = await ctx.db
            .query("knowledgeNodes")
            .withIndex("by_tenant_type", (q) =>
              q.eq("tenantId", args.tenantId).eq("type", conn.targetType)
            )
            .filter((q) => q.eq(q.field("name"), conn.targetName))
            .first();
          if (target) targetId = target._id;
        }

        if (targetId) {
          const existingEdge = await ctx.db
            .query("knowledgeEdges")
            .withIndex("by_source", (q) => q.eq("sourceNode", nodeId))
            .filter((q) =>
              q.and(
                q.eq(q.field("targetNode"), targetId),
                q.eq(q.field("relationship"), conn.relationship)
              )
            )
            .first();

          if (existingEdge) {
            await ctx.db.patch(existingEdge._id, {
              strength: Math.min(1.0, existingEdge.strength + 0.1),
            });
          } else {
            await ctx.db.insert("knowledgeEdges", {
              tenantId: args.tenantId,
              sourceNode: nodeId,
              targetNode: targetId,
              relationship: conn.relationship,
              strength: 0.5,
            });
          }
        }
      }
    }

    return nodeId;
  },
});

export const recordAccess = internalMutation({
  args: { nodeId: v.id("knowledgeNodes") },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) return;
    await ctx.db.patch(args.nodeId, {
      accessCount: node.accessCount + 1,
      lastConfirmedAt: Date.now(),
    });
  },
});

export const decayConfidence = internalMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const nodes = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const now = Date.now();
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

    for (const node of nodes) {
      if (node.archived) continue;
      if (node.source === "user_input") continue;

      const age = now - node.lastConfirmedAt;
      if (age > ONE_MONTH) {
        const monthsStale = Math.floor(age / ONE_MONTH);
        const decay = monthsStale * 0.05;
        const newConfidence = Math.max(0.1, node.confidence - decay);

        if (newConfidence <= 0.1 && !node.archived) {
          await ctx.db.patch(node._id, {
            confidence: newConfidence,
            archived: true,
          });
        } else if (newConfidence < node.confidence) {
          await ctx.db.patch(node._id, {
            confidence: newConfidence,
          });
        }
      }
    }
  },
});

export const ingestReservation = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    guestName: v.string(),
    propertyName: v.string(),
    platform: v.string(),
    checkIn: v.string(),
    checkOut: v.string(),
    status: v.string(),
    guests: v.optional(v.union(v.number(), v.null())),
    payout: v.optional(v.union(v.string(), v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    let propertyNode = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("type", "property")
      )
      .filter((q) => q.eq(q.field("name"), args.propertyName))
      .first();

    if (!propertyNode) {
      const propId = await ctx.db.insert("knowledgeNodes", {
        tenantId: args.tenantId,
        type: "property",
        name: args.propertyName,
        content: `Property listed on ${args.platform}. Synced from reservation data.`,
        confidence: 0.7,
        source: "scrape",
        tags: [args.platform],
        lastConfirmedAt: Date.now(),
        accessCount: 0,
        archived: false,
      });
      propertyNode = await ctx.db.get(propId);

      await ctx.db.insert("knowledgeFeed", {
        tenantId: args.tenantId,
        action: "created",
        nodeId: propId,
        summary: `Discovered property: "${args.propertyName}" from ${args.platform}`,
      });
    }

    let guestNode = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("type", "guest")
      )
      .filter((q) => q.eq(q.field("name"), args.guestName))
      .first();

    const guestContent = [
      `Guest booked ${args.propertyName}`,
      `Check-in: ${args.checkIn}, Check-out: ${args.checkOut}`,
      args.guests ? `Party size: ${args.guests}` : null,
      args.payout ? `Payout: ${args.payout}` : null,
      `Status: ${args.status}`,
      `Platform: ${args.platform}`,
    ]
      .filter(Boolean)
      .join(". ");

    if (guestNode) {
      const existingEdges = await ctx.db
        .query("knowledgeEdges")
        .withIndex("by_source", (q) => q.eq("sourceNode", guestNode._id))
        .filter((q) => q.eq(q.field("targetNode"), propertyNode._id))
        .collect();

      const isRepeat = existingEdges.length > 0;
      const updatedContent = isRepeat
        ? `${guestNode.content}\n\nReturn visit: ${args.checkIn}-${args.checkOut} at ${args.propertyName}.`
        : guestContent;

      await ctx.db.patch(guestNode._id, {
        content: updatedContent,
        confidence: Math.min(1.0, guestNode.confidence + 0.1),
        lastConfirmedAt: Date.now(),
        accessCount: guestNode.accessCount + 1,
      });

      if (isRepeat) {
        for (const edge of existingEdges) {
          await ctx.db.patch(edge._id, {
            strength: Math.min(1.0, edge.strength + 0.2),
          });
        }

        await ctx.db.insert("knowledgeFeed", {
          tenantId: args.tenantId,
          action: "updated",
          nodeId: guestNode._id,
          summary: `Repeat guest: "${args.guestName}" booked ${args.propertyName} again`,
        });
      }
    } else {
      const guestId = await ctx.db.insert("knowledgeNodes", {
        tenantId: args.tenantId,
        type: "guest",
        name: args.guestName,
        content: guestContent,
        confidence: 0.8,
        source: "booking",
        tags: [args.platform, args.propertyName],
        lastConfirmedAt: Date.now(),
        accessCount: 0,
        archived: false,
      });
      guestNode = await ctx.db.get(guestId);

      await ctx.db.insert("knowledgeFeed", {
        tenantId: args.tenantId,
        action: "created",
        nodeId: guestId,
        summary: `New guest: "${args.guestName}" -- booked ${args.propertyName}`,
      });
    }

    const existingEdge = await ctx.db
      .query("knowledgeEdges")
      .withIndex("by_source", (q) => q.eq("sourceNode", guestNode._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("targetNode"), propertyNode._id),
          q.eq(q.field("relationship"), "stayed_at")
        )
      )
      .first();

    if (!existingEdge) {
      await ctx.db.insert("knowledgeEdges", {
        tenantId: args.tenantId,
        sourceNode: guestNode._id,
        targetNode: propertyNode._id,
        relationship: "stayed_at",
        strength: 0.6,
      });
    }
  },
});

export const ingestProperty = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    platform: v.string(),
    location: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("knowledgeNodes")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("type", "property")
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    const content = [
      `Property listed on ${args.platform}`,
      args.location ? `Location: ${args.location}` : null,
      args.details || null,
    ]
      .filter(Boolean)
      .join(". ");

    if (existing) {
      const mergedContent =
        args.details && !existing.content.includes(args.details)
          ? `${existing.content}\n${args.details}`
          : existing.content;

      await ctx.db.patch(existing._id, {
        content: mergedContent,
        lastConfirmedAt: Date.now(),
        accessCount: existing.accessCount + 1,
        tags: [...new Set([...(existing.tags || []), args.platform])],
      });
    } else {
      const nodeId = await ctx.db.insert("knowledgeNodes", {
        tenantId: args.tenantId,
        type: "property",
        name: args.name,
        content,
        confidence: 0.75,
        source: "scrape",
        tags: [args.platform, args.location || ""].filter(Boolean),
        lastConfirmedAt: Date.now(),
        accessCount: 0,
        archived: false,
      });

      await ctx.db.insert("knowledgeFeed", {
        tenantId: args.tenantId,
        action: "created",
        nodeId,
        summary: `Discovered property: "${args.name}" on ${args.platform}`,
      });
    }
  },
});

// --- Internal Query (For agent context building) ---

export const getRelevantContext = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    propertyName: v.optional(v.string()),
    guestName: v.optional(v.string()),
    maxNodes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.maxNodes || 20;
    const relevantNodes = [];
    const anchorIds = [];

    if (args.propertyName) {
      const prop = await ctx.db
        .query("knowledgeNodes")
        .withIndex("by_tenant_type", (q) =>
          q.eq("tenantId", args.tenantId).eq("type", "property")
        )
        .filter((q) => q.eq(q.field("name"), args.propertyName))
        .first();
      if (prop) {
        relevantNodes.push(prop);
        anchorIds.push(prop._id);
      }
    }

    if (args.guestName) {
      const guest = await ctx.db
        .query("knowledgeNodes")
        .withIndex("by_tenant_type", (q) =>
          q.eq("tenantId", args.tenantId).eq("type", "guest")
        )
        .filter((q) => q.eq(q.field("name"), args.guestName))
        .first();
      if (guest) {
        relevantNodes.push(guest);
        anchorIds.push(guest._id);
      }
    }

    const seen = new Set(anchorIds.map(String));
    for (const anchorId of anchorIds) {
      const outEdges = await ctx.db
        .query("knowledgeEdges")
        .withIndex("by_source", (q) => q.eq("sourceNode", anchorId))
        .collect();

      const inEdges = await ctx.db
        .query("knowledgeEdges")
        .withIndex("by_target", (q) => q.eq("targetNode", anchorId))
        .collect();

      for (const edge of [...outEdges, ...inEdges]) {
        const otherId =
          edge.sourceNode === anchorId ? edge.targetNode : edge.sourceNode;
        if (!seen.has(String(otherId))) {
          seen.add(String(otherId));
          const node = await ctx.db.get(otherId);
          if (node && !node.archived && node.confidence > 0.3) {
            relevantNodes.push(node);
          }
        }
      }
    }

    return relevantNodes
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  },
});
