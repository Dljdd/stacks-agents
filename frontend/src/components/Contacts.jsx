import React, { useState, useEffect } from 'react'

export default function Contacts({ api }) {
  const [contacts, setContacts] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    nickname: '',
    notes: ''
  })

  useEffect(() => {
    loadContacts()
  }, [])

  function loadContacts() {
    // Load from localStorage for now
    const saved = localStorage.getItem('stacks-contacts')
    if (saved) {
      setContacts(JSON.parse(saved))
    }
  }

  function saveContacts(newContacts) {
    localStorage.setItem('stacks-contacts', JSON.stringify(newContacts))
    setContacts(newContacts)
  }

  function addContact(e) {
    e.preventDefault()
    const newContact = {
      id: Date.now().toString(),
      ...formData,
      createdAt: new Date().toISOString()
    }
    const newContacts = [...contacts, newContact]
    saveContacts(newContacts)
    setFormData({ name: '', address: '', nickname: '', notes: '' })
    setShowAddForm(false)
  }

  function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
      const newContacts = contacts.filter(c => c.id !== id)
      saveContacts(newContacts)
    }
  }

  function editContact(contact) {
    setFormData(contact)
    setShowAddForm(true)
  }

  return (
    <div className="contacts">
      <div className="section-header">
        <h2>Payment Contacts</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          + Add Contact
        </button>
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{formData.id ? 'Edit Contact' : 'Add New Contact'}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowAddForm(false)
                  setFormData({ name: '', address: '', nickname: '', notes: '' })
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={addContact} className="contact-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Sam Johnson"
                  required
                />
              </div>
              <div className="form-group">
                <label>Stacks Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="ST..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Nickname</label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                  placeholder="e.g., SAM, SAMMY (for chatbot commands)"
                />
                <small>Use short nicknames for easy chatbot commands like "pay 100 to SAM"</small>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Optional notes about this contact"
                  rows="2"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => {
                  setShowAddForm(false)
                  setFormData({ name: '', address: '', nickname: '', notes: '' })
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {formData.id ? 'Update Contact' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="contacts-grid">
        {contacts.map(contact => (
          <div key={contact.id} className="contact-card">
            <div className="contact-header">
              <div className="contact-avatar">
                {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="contact-info">
                <h3>{contact.name}</h3>
                {contact.nickname && (
                  <div className="contact-nickname">@{contact.nickname}</div>
                )}
              </div>
            </div>
            <div className="contact-details">
              <div className="detail-row">
                <span>Address:</span>
                <span className="mono">{contact.address.slice(0, 12)}...</span>
              </div>
              {contact.notes && (
                <div className="detail-row">
                  <span>Notes:</span>
                  <span>{contact.notes}</span>
                </div>
              )}
              <div className="detail-row">
                <span>Added:</span>
                <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="contact-actions">
              <button 
                className="btn btn-sm"
                onClick={() => editContact(contact)}
              >
                Edit
              </button>
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => navigator.clipboard.writeText(contact.address)}
              >
                Copy Address
              </button>
              <button 
                className="btn btn-sm btn-danger"
                onClick={() => deleteContact(contact.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {contacts.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No contacts yet</h3>
          <p>Add contacts to use with the chatbot for easy payments</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            Add Your First Contact
          </button>
        </div>
      )}

      <div className="contacts-help">
        <h3>💡 Chatbot Tips</h3>
        <ul>
          <li>Use short nicknames like "SAM", "JOHN" for easy commands</li>
          <li>Try: "pay 100 STX to SAM for dinner"</li>
          <li>Try: "send 50 to ALICE with memo hosting fees"</li>
          <li>The chatbot will automatically resolve nicknames to addresses</li>
        </ul>
      </div>
    </div>
  )
}
