import { Building2, Plus } from 'lucide-react';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 24,
};

export default function Properties() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            Properties
          </h1>
          <p style={{ color: '#666' }}>
            Manage your rental properties. Alfred learns the details of each one.
          </p>
        </div>
        <button style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#c67d3b',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          <Plus size={16} /> Add Property
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ color: '#666', fontSize: 14, textAlign: 'center', padding: 48 }}>
          <Building2 size={32} color="#333" style={{ marginBottom: 12 }} />
          <p>No properties yet. Add your first property to get started.</p>
        </div>
      </div>
    </div>
  );
}
