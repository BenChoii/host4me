"use client"

import { Building2, Plus, MapPin, Users, Wifi, Key, Clock } from 'lucide-react'

export default function Properties() {
  // TODO: Wire to Convex useQuery(api.queries.getProperties)
  const properties: any[] = []

  return (
    <div>
      <div className="dash-animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--dash-text-muted)', margin: 0 }}>
            Manage your rental properties. Alfred learns the details of each one.
          </p>
        </div>
        <button className="dash-btn dash-btn-primary">
          <Plus size={14} /> Add Property
        </button>
      </div>

      {properties.length > 0 ? (
        <div className="dash-property-grid">
          {properties.map((property: any) => (
            <div key={property._id} className="dash-property-card dash-animate-in">
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontWeight: 600, color: 'var(--dash-text)' }}>{property.name}</div>
                <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MapPin size={11} />{property.location}
                </div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--dash-border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {property.wifiPassword && <span className="dash-status idle" style={{ gap: 4 }}><Wifi size={10} /> WiFi</span>}
                {property.gateCode && <span className="dash-status idle" style={{ gap: 4 }}><Key size={10} /> Gate Code</span>}
                <span className="dash-status idle" style={{ gap: 4 }}><Clock size={10} /> {property.checkInTime}</span>
                <span className="dash-status idle" style={{ gap: 4 }}><Users size={10} /> {property.maxGuests} guests</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-card dash-animate-in">
          <div className="dash-empty">
            <div className="dash-empty-icon">
              <Building2 size={22} color="var(--dash-text-muted)" />
            </div>
            <div className="dash-empty-title">No properties yet</div>
            <div className="dash-empty-desc">
              Add your first property so Alfred can start monitoring guest messages and learning your property details.
            </div>
            <button className="dash-btn dash-btn-primary" style={{ marginTop: 16 }}>
              <Plus size={14} /> Add Property
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
