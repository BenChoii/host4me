import { Building2, Plus, MapPin, Users, Wifi, Key, Clock } from 'lucide-react';

export default function Properties() {
  // TODO: Wire to Convex useQuery(api.queries.getProperties)
  const properties = [];

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
          {properties.map((property) => (
            <div key={property._id} className="dash-property-card dash-animate-in">
              <div className="dash-property-header">
                <div>
                  <div className="dash-property-name">{property.name}</div>
                  <div className="dash-property-location">
                    <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {property.location}
                  </div>
                </div>
                <span className="dash-status active">
                  <span className="dash-status-dot" />
                  Monitored
                </span>
              </div>

              {/* What Alfred knows */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--dash-border)', marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--dash-text-muted)', marginBottom: 10 }}>
                  Alfred Knows
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {property.wifiPassword && (
                    <span className="dash-status idle" style={{ gap: 4 }}>
                      <Wifi size={10} /> WiFi
                    </span>
                  )}
                  {property.gateCode && (
                    <span className="dash-status idle" style={{ gap: 4 }}>
                      <Key size={10} /> Gate Code
                    </span>
                  )}
                  <span className="dash-status idle" style={{ gap: 4 }}>
                    <Clock size={10} /> {property.checkInTime}
                  </span>
                  <span className="dash-status idle" style={{ gap: 4 }}>
                    <Users size={10} /> {property.maxGuests} guests
                  </span>
                </div>
              </div>

              <div className="dash-property-stats">
                <div className="dash-property-stat">
                  <div className="dash-property-stat-value">0</div>
                  <div className="dash-property-stat-label">Messages</div>
                </div>
                <div className="dash-property-stat">
                  <div className="dash-property-stat-value">—</div>
                  <div className="dash-property-stat-label">Avg Reply</div>
                </div>
                <div className="dash-property-stat">
                  <div className="dash-property-stat-value">0</div>
                  <div className="dash-property-stat-label">Bookings</div>
                </div>
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
  );
}
