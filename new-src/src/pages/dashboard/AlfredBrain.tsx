/**
 * Alfred's Brain — Knowledge Graph Visualization
 *
 * Interactive d3-force graph showing everything Alfred has learned.
 * Nodes = knowledge entities, edges = relationships between them.
 * Users can explore, search, filter, edit, and add knowledge.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Check,
  Pencil,
  Trash2,
  Plus,
  Sparkles,
  Clock,
  Link2,
  ChevronRight,
  TrendingUp,
  Eye,
} from "lucide-react";

// ─── Node Type Configuration ───────────────────────────────────────────────

const NODE_TYPES: Record<string, { color: string; label: string; icon: string }> = {
  property:   { color: "#22c55e", label: "Property",   icon: "🏠" },
  guest:      { color: "#3b82f6", label: "Guest",      icon: "👤" },
  preference: { color: "#f59e0b", label: "Preference", icon: "💡" },
  issue:      { color: "#ef4444", label: "Issue",      icon: "⚠️" },
  vendor:     { color: "#8b5cf6", label: "Vendor",     icon: "🔧" },
  area_tip:   { color: "#06b6d4", label: "Area Tip",   icon: "📍" },
  pattern:    { color: "#ec4899", label: "Pattern",    icon: "📊" },
  platform:   { color: "#f97316", label: "Platform",   icon: "🌐" },
  rule:       { color: "#64748b", label: "Rule",       icon: "📋" },
};

const NODE_SIZES: Record<string, number> = {
  property: 26, guest: 20, preference: 16, issue: 18,
  vendor: 18, area_tip: 16, pattern: 18, platform: 18, rule: 16,
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface KnowledgeNode {
  _id: string;
  _creationTime: number;
  type: string;
  name: string;
  content: string;
  confidence: number;
  source: string;
  lastConfirmedAt: number;
  accessCount: number;
  tags?: string[];
  // d3 simulation fields
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface KnowledgeEdge {
  _id: string;
  sourceNode: string;
  targetNode: string;
  relationship: string;
  strength: number;
  // d3 resolved references
  source?: any;
  target?: any;
}

interface FeedItem {
  _id: string;
  _creationTime: number;
  action: string;
  summary: string;
}

// ─── d3 Force Simulation (vanilla — no d3 import needed) ──────────────────
// We implement a minimal force simulation to avoid adding d3 as a dependency.
// This keeps the bundle lean while giving us the interactive graph.

function createSimulation(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  width: number,
  height: number,
  onTick: () => void,
) {
  // Initialize positions
  const cx = width / 2;
  const cy = height / 2;
  for (const node of nodes) {
    if (node.x === undefined) {
      node.x = cx + (Math.random() - 0.5) * 400;
      node.y = cy + (Math.random() - 0.5) * 400;
    }
  }

  // Build lookup
  const nodeMap = new Map<string, KnowledgeNode>();
  for (const n of nodes) nodeMap.set(n._id, n);

  // Resolve edges to node references
  const resolvedEdges = edges
    .map((e) => ({
      ...e,
      source: nodeMap.get(e.sourceNode),
      target: nodeMap.get(e.targetNode),
    }))
    .filter((e) => e.source && e.target);

  let alpha = 1;
  let alphaDecay = 0.0228;
  let alphaMin = 0.001;
  let running = true;

  function tick() {
    if (!running || alpha < alphaMin) return;

    // Center force
    for (const n of nodes) {
      n.x! += (cx - n.x!) * 0.01 * alpha;
      n.y! += (cy - n.y!) * 0.01 * alpha;
    }

    // Charge repulsion (n-body — simplified Barnes-Hut not needed for <500 nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x! - a.x!;
        let dy = b.y! - a.y!;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (-300 * alpha) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.fx === null || a.fx === undefined) { a.x! -= fx; a.y! -= fy; }
        if (b.fx === null || b.fx === undefined) { b.x! += fx; b.y! += fy; }
      }
    }

    // Link spring force
    for (const e of resolvedEdges) {
      const s = e.source!;
      const t = e.target!;
      let dx = t.x! - s.x!;
      let dy = t.y! - s.y!;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 140;
      const force = ((dist - targetDist) / dist) * 0.3 * alpha;
      const fx = dx * force;
      const fy = dy * force;
      if (s.fx === null || s.fx === undefined) { s.x! += fx; s.y! += fy; }
      if (t.fx === null || t.fx === undefined) { t.x! -= fx; t.y! -= fy; }
    }

    // Collision
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ra = (NODE_SIZES[a.type] || 16) + 4;
        const rb = (NODE_SIZES[b.type] || 16) + 4;
        let dx = b.x! - a.x!;
        let dy = b.y! - a.y!;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = ra + rb;
        if (dist < minDist) {
          const overlap = (minDist - dist) / dist * 0.5;
          if (a.fx === null || a.fx === undefined) { a.x! -= dx * overlap; a.y! -= dy * overlap; }
          if (b.fx === null || b.fx === undefined) { b.x! += dx * overlap; b.y! += dy * overlap; }
        }
      }
    }

    alpha *= (1 - alphaDecay);
    onTick();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    resolvedEdges,
    reheat: () => { alpha = 0.3; requestAnimationFrame(tick); },
    stop: () => { running = false; },
  };
}

// ─── Relative Time ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AlfredBrain() {
  const graphData = useQuery(api.knowledge.getGraph);
  const stats = useQuery(api.knowledge.getStats);
  const confirmNode = useMutation(api.knowledge.confirmNode);
  const archiveNode = useMutation(api.knowledge.archiveNode);
  const editNodeMut = useMutation(api.knowledge.editNode);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof createSimulation> | null>(null);
  const nodesRef = useRef<KnowledgeNode[]>([]);
  const edgesRef = useRef<KnowledgeEdge[]>([]);

  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNode | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(Object.keys(NODE_TYPES)));
  const [searchQuery, setSearchQuery] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  // Drag state
  const dragRef = useRef<{
    node: KnowledgeNode | null;
    startX: number;
    startY: number;
    isPanning: boolean;
    panStartX: number;
    panStartY: number;
    panStartTx: number;
    panStartTy: number;
  }>({
    node: null,
    startX: 0,
    startY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartTx: 0,
    panStartTy: 0,
  });

  // ─── Sync Convex data → simulation ────────────────────────────────────

  useEffect(() => {
    if (!graphData) return;

    // Preserve existing positions for nodes that haven't changed
    const oldPositions = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      if (n.x !== undefined && n.y !== undefined) {
        oldPositions.set(n._id, { x: n.x, y: n.y });
      }
    }

    const newNodes: KnowledgeNode[] = graphData.nodes.map((n: any) => {
      const old = oldPositions.get(n._id);
      return { ...n, x: old?.x, y: old?.y, fx: null, fy: null };
    });

    nodesRef.current = newNodes;
    edgesRef.current = graphData.edges;

    // Restart simulation
    if (simRef.current) simRef.current.stop();
    simRef.current = createSimulation(
      newNodes,
      graphData.edges,
      dimensions.w,
      dimensions.h,
      () => draw(),
    );
  }, [graphData, dimensions]);

  // ─── Resize observer ──────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ w: width, h: height });
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width * (window.devicePixelRatio || 1);
          canvas.height = height * (window.devicePixelRatio || 1);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Canvas Drawing ───────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Apply transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const nodes = nodesRef.current;
    const sim = simRef.current;
    if (!sim) { ctx.restore(); return; }

    const searchLower = searchQuery.toLowerCase();
    const isSearching = searchLower.length > 0;

    // Determine visibility
    const isVisible = (n: KnowledgeNode) => {
      if (!activeFilters.has(n.type)) return false;
      if (isSearching) {
        return n.name.toLowerCase().includes(searchLower) ||
               n.content.toLowerCase().includes(searchLower);
      }
      return true;
    };

    const visibleIds = new Set(nodes.filter(isVisible).map((n) => n._id));

    // Determine highlighted connections
    const highlightedIds = new Set<string>();
    const highlightedEdges = new Set<string>();
    if (hoveredNode || selectedNode) {
      const focus = hoveredNode || selectedNode;
      highlightedIds.add(focus!._id);
      for (const e of sim.resolvedEdges) {
        if (e.source?._id === focus!._id || e.target?._id === focus!._id) {
          highlightedIds.add(e.source!._id);
          highlightedIds.add(e.target!._id);
          highlightedEdges.add(e._id);
        }
      }
    }

    const hasFocus = highlightedIds.size > 0;

    // Draw edges
    for (const e of sim.resolvedEdges) {
      const s = e.source!;
      const t = e.target!;
      if (!visibleIds.has(s._id) || !visibleIds.has(t._id)) continue;

      const isHighlighted = highlightedEdges.has(e._id);
      ctx.beginPath();
      ctx.moveTo(s.x!, s.y!);
      ctx.lineTo(t.x!, t.y!);
      ctx.strokeStyle = isHighlighted
        ? (NODE_TYPES[s.type]?.color || "#888") + "80"
        : hasFocus ? "#1a1a2e30" : "#1a1a2e80";
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();

      // Edge label (only when highlighted)
      if (isHighlighted && transform.k > 0.6) {
        const mx = (s.x! + t.x!) / 2;
        const my = (s.y! + t.y!) / 2;
        ctx.font = "9px Inter, sans-serif";
        ctx.fillStyle = "#66668888";
        ctx.textAlign = "center";
        ctx.fillText(e.relationship, mx, my - 4);
      }
    }

    // Draw nodes
    for (const n of nodes) {
      if (!visibleIds.has(n._id)) continue;
      const r = NODE_SIZES[n.type] || 16;
      const typeInfo = NODE_TYPES[n.type] || { color: "#888", icon: "•" };
      const isDimmed = hasFocus && !highlightedIds.has(n._id);
      const isSelected = selectedNode?._id === n._id;
      const globalAlpha = isDimmed ? 0.15 : 1;

      ctx.globalAlpha = globalAlpha;

      // Glow ring
      if (!isDimmed) {
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = typeInfo.color + "25";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Main circle fill
      ctx.beginPath();
      ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2);
      ctx.fillStyle = typeInfo.color + "18";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fff" : typeInfo.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Confidence ring (partial arc showing confidence level)
      if (!isDimmed && n.confidence < 1) {
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * n.confidence);
        ctx.strokeStyle = typeInfo.color + "60";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Icon
      ctx.font = `${r * 0.75}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(typeInfo.icon, n.x!, n.y!);

      // Label
      if (transform.k > 0.5) {
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = isDimmed ? "#44446630" : "#9d9db5";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = n.name.length > 20 ? n.name.slice(0, 18) + "…" : n.name;
        ctx.fillText(label, n.x!, n.y! + r + 6);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [transform, searchQuery, activeFilters, hoveredNode, selectedNode]);

  // Redraw on state changes
  useEffect(() => { draw(); }, [draw]);

  // ─── Mouse Interaction ────────────────────────────────────────────────

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - transform.x) / transform.k,
      y: (sy - transform.y) / transform.k,
    }),
    [transform]
  );

  const findNodeAt = useCallback(
    (wx: number, wy: number): KnowledgeNode | null => {
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i];
        if (!activeFilters.has(n.type)) continue;
        const r = (NODE_SIZES[n.type] || 16) + 4;
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        if (dx * dx + dy * dy < r * r) return n;
      }
      return null;
    },
    [activeFilters]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);

      if (node) {
        dragRef.current = { ...dragRef.current, node, startX: wx, startY: wy, isPanning: false };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.reheat();
      } else {
        dragRef.current = {
          ...dragRef.current,
          node: null,
          isPanning: true,
          panStartX: sx,
          panStartY: sy,
          panStartTx: transform.x,
          panStartTy: transform.y,
        };
      }
    },
    [screenToWorld, findNodeAt, transform]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);

      if (dragRef.current.node) {
        // Dragging a node
        dragRef.current.node.fx = wx;
        dragRef.current.node.fy = wy;
        draw();
      } else if (dragRef.current.isPanning) {
        // Panning the canvas
        const dx = sx - dragRef.current.panStartX;
        const dy = sy - dragRef.current.panStartY;
        setTransform((t) => ({
          ...t,
          x: dragRef.current.panStartTx + dx,
          y: dragRef.current.panStartTy + dy,
        }));
      } else {
        // Hover detection
        const node = findNodeAt(wx, wy);
        setHoveredNode(node);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = node ? "pointer" : "grab";
        }
      }
    },
    [screenToWorld, findNodeAt, draw]
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.node) {
      dragRef.current.node.fx = null;
      dragRef.current.node.fy = null;
      simRef.current?.reheat();
    }
    dragRef.current = { ...dragRef.current, node: null, isPanning: false };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);
      setSelectedNode(node);
      setEditingNode(null);
    },
    [screenToWorld, findNodeAt]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const delta = -e.deltaY * 0.001;
      const newK = Math.max(0.2, Math.min(4, transform.k * (1 + delta)));
      const ratio = newK / transform.k;

      setTransform({
        x: sx - (sx - transform.x) * ratio,
        y: sy - (sy - transform.y) * ratio,
        k: newK,
      });
    },
    [transform]
  );

  // ─── Controls ─────────────────────────────────────────────────────────

  const zoomIn = () => {
    setTransform((t) => {
      const newK = Math.min(4, t.k * 1.3);
      const cx = dimensions.w / 2;
      const cy = dimensions.h / 2;
      return { x: cx - (cx - t.x) * (newK / t.k), y: cy - (cy - t.y) * (newK / t.k), k: newK };
    });
  };

  const zoomOut = () => {
    setTransform((t) => {
      const newK = Math.max(0.2, t.k * 0.7);
      const cx = dimensions.w / 2;
      const cy = dimensions.h / 2;
      return { x: cx - (cx - t.x) * (newK / t.k), y: cy - (cy - t.y) * (newK / t.k), k: newK };
    });
  };

  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // ─── Editing ──────────────────────────────────────────────────────────

  const startEditing = (node: KnowledgeNode) => {
    setEditingNode(node._id);
    setEditName(node.name);
    setEditContent(node.content);
  };

  const saveEdit = async () => {
    if (!editingNode) return;
    await editNodeMut({ nodeId: editingNode as any, name: editName, content: editContent });
    setEditingNode(null);
    // Update local node reference
    if (selectedNode && selectedNode._id === editingNode) {
      setSelectedNode({ ...selectedNode, name: editName, content: editContent });
    }
  };

  // ─── Feed items ───────────────────────────────────────────────────────

  const feedItems = graphData?.feed || [];

  // ─── Empty State ──────────────────────────────────────────────────────

  const isEmpty = !graphData || graphData.nodes.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="brain-container">
      {/* ── Left Panel ── */}
      <div className="brain-sidebar">
        <div className="brain-sidebar-header">
          <div className="brain-title-row">
            <div className="brain-icon-wrap">
              <Brain size={18} />
            </div>
            <h2>Alfred's Brain</h2>
          </div>
          <div className="brain-stats">
            <div className="brain-stat">
              <span className="brain-stat-value">{stats?.nodeCount ?? 0}</span>
              <span className="brain-stat-label">Nodes</span>
            </div>
            <div className="brain-stat">
              <span className="brain-stat-value">{stats?.edgeCount ?? 0}</span>
              <span className="brain-stat-label">Connections</span>
            </div>
            <div className="brain-stat">
              <span className="brain-stat-value">{stats?.learnedToday ?? 0}</span>
              <span className="brain-stat-label">Today</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="brain-filters">
          <div className="brain-section-label">Categories</div>
          <div className="brain-chip-row">
            {Object.entries(NODE_TYPES).map(([type, info]) => (
              <button
                key={type}
                className={`brain-chip ${activeFilters.has(type) ? "active" : ""}`}
                onClick={() => toggleFilter(type)}
              >
                <span className="brain-chip-dot" style={{ background: info.color }} />
                {info.label}
                {stats?.typeCounts?.[type] ? (
                  <span className="brain-chip-count">{stats.typeCounts[type]}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="brain-detail">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <div className="brain-detail-header">
                  <span
                    className="brain-type-badge"
                    style={{
                      background: (NODE_TYPES[selectedNode.type]?.color || "#888") + "18",
                      color: NODE_TYPES[selectedNode.type]?.color || "#888",
                    }}
                  >
                    {NODE_TYPES[selectedNode.type]?.label || selectedNode.type}
                  </span>
                  <div className="brain-detail-actions">
                    <button
                      className="brain-icon-btn"
                      title="Confirm"
                      onClick={() => confirmNode({ nodeId: selectedNode._id as any })}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="brain-icon-btn"
                      title="Edit"
                      onClick={() => startEditing(selectedNode)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="brain-icon-btn danger"
                      title="Archive"
                      onClick={() => {
                        archiveNode({ nodeId: selectedNode._id as any });
                        setSelectedNode(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingNode === selectedNode._id ? (
                  <div className="brain-edit-form">
                    <input
                      className="brain-edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                    />
                    <textarea
                      className="brain-edit-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                    />
                    <div className="brain-edit-actions">
                      <button className="brain-btn-save" onClick={saveEdit}>Save</button>
                      <button className="brain-btn-cancel" onClick={() => setEditingNode(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="brain-detail-title">{selectedNode.name}</h3>
                    <div className="brain-detail-meta">
                      <span><Clock size={12} /> {timeAgo(selectedNode.lastConfirmedAt)}</span>
                      <span><Eye size={12} /> {selectedNode.accessCount} accesses</span>
                      <span>
                        <TrendingUp size={12} /> {Math.round(selectedNode.confidence * 100)}%
                        <span
                          className="brain-confidence-bar"
                          style={{ "--conf": `${selectedNode.confidence * 100}%` } as any}
                        />
                      </span>
                    </div>
                    <div className="brain-detail-content">{selectedNode.content}</div>
                    {selectedNode.tags && selectedNode.tags.length > 0 && (
                      <div className="brain-detail-tags">
                        {selectedNode.tags.map((tag) => (
                          <span key={tag} className="brain-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="brain-detail-source">
                      Source: {selectedNode.source}
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="brain-detail-empty"
              >
                <Sparkles size={20} />
                <p>Click a node to explore</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Learning Feed */}
        <div className="brain-feed">
          <div className="brain-section-label">Recent Learning</div>
          {feedItems.length === 0 ? (
            <div className="brain-feed-empty">
              Alfred hasn't learned anything yet. Connect a platform to get started.
            </div>
          ) : (
            feedItems.slice(0, 8).map((item: FeedItem) => (
              <div key={item._id} className="brain-feed-item">
                <span className="brain-feed-time">{timeAgo(item._creationTime)}</span>
                <span className="brain-feed-text">{item.summary}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Graph Canvas ── */}
      <div className="brain-graph" ref={containerRef}>
        {/* Search */}
        <div className="brain-search">
          <Search size={14} className="brain-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Alfred's knowledge..."
          />
          {searchQuery && (
            <button className="brain-search-clear" onClick={() => setSearchQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Zoom controls */}
        <div className="brain-controls">
          <button className="brain-ctrl-btn" onClick={zoomIn} title="Zoom in"><ZoomIn size={16} /></button>
          <button className="brain-ctrl-btn" onClick={zoomOut} title="Zoom out"><ZoomOut size={16} /></button>
          <button className="brain-ctrl-btn" onClick={resetView} title="Reset"><Maximize2 size={16} /></button>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="brain-empty-state">
            <div className="brain-empty-icon">🧠</div>
            <h3>Alfred's brain is empty</h3>
            <p>
              As Alfred syncs your properties and handles guest conversations,
              knowledge will appear here as an interactive graph.
            </p>
            <p className="brain-empty-hint">
              Connect a platform in Settings to start learning.
            </p>
          </div>
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ display: "block" }}
        />

        {/* Hover tooltip */}
        {hoveredNode && !dragRef.current.node && (
          <div
            className="brain-tooltip"
            style={{
              left: (hoveredNode.x! * transform.k + transform.x + 20) + "px",
              top: (hoveredNode.y! * transform.k + transform.y - 10) + "px",
            }}
          >
            <div
              className="brain-tooltip-type"
              style={{ color: NODE_TYPES[hoveredNode.type]?.color }}
            >
              {NODE_TYPES[hoveredNode.type]?.label}
            </div>
            <div className="brain-tooltip-name">{hoveredNode.name}</div>
          </div>
        )}
      </div>
    </div>
  );
}
