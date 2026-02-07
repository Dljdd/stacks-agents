import React, { useState } from 'react'
import { Users, Plus, Edit3, Trash2, UserPlus, X } from 'lucide-react'

const ContactCard = ({ contact, onEdit, onDelete }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all duration-300">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-400 font-bold text-lg">
        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-white">{contact.name}</h3>
        {contact.nickname && (
          <div className="text-sm text-slate-400">@{contact.nickname}</div>
        )}
      </div>
    </div>
    <div className="space-y-3 mb-6">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">Address</span>
        <span className="font-mono text-blue-400">{contact.address.slice(0, 12)}...</span>
      </div>
      {contact.notes && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Notes</span>
          <span className="text-slate-300">{contact.notes}</span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">Added</span>
        <span className="font-mono text-slate-300">{new Date(contact.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
    <div className="flex gap-2">
      <button 
        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors"
        onClick={() => onEdit(contact)}
      >
        <Edit3 size={14} strokeWidth={1.5} />
        Edit
      </button>
      <button 
        className="flex-1 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors"
        onClick={() => navigator.clipboard.writeText(contact.address)}
      >
        Copy
      </button>
      <button 
        className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
        onClick={() => onDelete(contact.id)}
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  </div>
)

export default function Contacts() {
  const [contacts, setContacts] = useState([
    {
      id: '1',
      name: 'Alice Johnson',
      address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      nickname: 'ALICE',
      notes: 'Business partner',
      createdAt: '2025-09-01T10:00:00Z'
    },
    {
      id: '2',
      name: 'Bob Smith',
      address: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      nickname: 'BOB',
      notes: 'Hosting provider',
      createdAt: '2025-09-02T15:30:00Z'
    }
  ])
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    nickname: '',
    notes: ''
  })

  function addContact(e) {
    e.preventDefault()
    const newContact = {
      id: Date.now().toString(),
      ...formData,
      createdAt: new Date().toISOString()
    }
    setContacts([...contacts, newContact])
    setFormData({ name: '', address: '', nickname: '', notes: '' })
    setShowAddForm(false)
  }

  function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
      setContacts(contacts.filter(c => c.id !== id))
    }
  }

  function editContact(contact) {
    setFormData(contact)
    setShowAddForm(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Contacts</h1>
            <p className="text-slate-400">Manage your payment network contacts</p>
          </div>
          <button 
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={18} strokeWidth={1.5} />
            Add Contact
          </button>
        </div>

        {/* Add Contact Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">{formData.id ? 'Edit Contact' : 'Add New Contact'}</h3>
                <button 
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({ name: '', address: '', nickname: '', notes: '' })
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={addContact} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Sam Johnson"
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Stacks Address *</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="ST..."
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nickname</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                    placeholder="e.g., SAM (for chatbot commands)"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">Use short nicknames for easy chatbot commands like "pay 100 to SAM"</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Optional notes about this contact"
                    rows="3"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddForm(false)
                      setFormData({ name: '', address: '', nickname: '', notes: '' })
                    }}
                    className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold"
                  >
                    {formData.id ? 'Update Contact' : 'Add Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {contacts.map(contact => (
            <ContactCard 
              key={contact.id} 
              contact={contact} 
              onEdit={editContact}
              onDelete={deleteContact}
            />
          ))}
        </div>

        {/* Empty State */}
        {contacts.length === 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
            <UserPlus className="w-16 h-16 mx-auto mb-4 text-emerald-400" strokeWidth={1} />
            <h3 className="text-xl font-semibold mb-2 text-white">No contacts yet</h3>
            <p className="text-slate-400 mb-6">
              Add contacts to use nicknames in your payment commands
            </p>
            <button 
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold mx-auto"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={18} strokeWidth={1.5} />
              Add your first contact
            </button>
          </div>
        )}

        {/* Chatbot Tips */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Users className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white">Chatbot Tips</h3>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div>Use short nicknames like "SAM", "JOHN" for easy commands</div>
            <div className="font-mono bg-slate-700/30 px-3 py-2 rounded-lg">Try: "pay 100 STX to SAM for dinner"</div>
            <div className="font-mono bg-slate-700/30 px-3 py-2 rounded-lg">Try: "send 50 to ALICE with memo hosting fees"</div>
            <div>The chatbot will automatically resolve nicknames to addresses</div>
          </div>
        </div>
      </div>
    </div>
  )
}
