'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

interface Expense {
  id: number;
  category_id: number | null;
  description: string;
  amount: number;
  expense_date: string;
  gig_id: number | null;
  receipt_reference: string | null;
  notes: string | null;
  created_at: string;
  category_name: string | null;
  gig_title: string | null;
}

interface ExpenseCategory {
  id: number;
  name: string;
  is_default: number;
  created_at: string;
}

interface ExpensesData {
  expenses: Expense[];
  categories: ExpenseCategory[];
  total: number;
}

interface ExpenseFormData {
  category_id: number | null;
  description: string;
  amount: number;
  expense_date: string;
  notes: string;
}

export default function ExpensesPage() {
  const [data, setData] = useState<ExpensesData>({ expenses: [], categories: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const loadedRef = useRef(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const res = await fetch(`/api/expenses?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [categoryFilter, dateFrom, dateTo]);

  // Initial load
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchExpenses();
    }
  }, [fetchExpenses]);

  const handleCreate = async (formData: ExpenseFormData) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) { setShowModal(false); fetchExpenses(); }
  };

  const handleCreateCategory = async (name: string) => {
    const res = await fetch('/api/expenses/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { setShowCategoryModal(false); fetchExpenses(); }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/expenses/categories?id=${id}`, { method: 'DELETE' });
    fetchExpenses();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-1">Track business expenditures</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition text-sm">
            Manage Categories
          </button>
          <button onClick={() => setShowModal(true)} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">
            + Add Expense
          </button>
        </div>
      </div>

      <div className="bg-red-50 rounded-2xl p-5 border-2 border-red-200">
        <p className="text-sm font-bold text-red-700 uppercase">Total Expenses</p>
        <p className="text-2xl font-bold text-red-800">{formatCurrency(data.total)}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none">
          <option value="all">All Categories</option>
          {data.categories.map((c: ExpenseCategory) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" placeholder="To" />
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : data.expenses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 mb-4">No expenses found</p>
          <button onClick={() => setShowModal(true)} className="text-gray-900 font-medium hover:underline">Record your first expense</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {data.expenses.map((e: Expense) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{e.description}</p>
                  <p className="text-sm text-gray-500">{e.category_name || 'Uncategorized'} &bull; {e.expense_date}{e.gig_title && ` • ${e.gig_title}`}</p>
                </div>
                <p className="font-semibold text-red-700">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <ExpenseModal categories={data.categories} onClose={() => setShowModal(false)} onSubmit={handleCreate} />}
      {showCategoryModal && <CategoryModal categories={data.categories} onClose={() => setShowCategoryModal(false)} onCreate={handleCreateCategory} onDelete={handleDeleteCategory} />}
    </div>
  );
}

function ExpenseModal({ categories, onClose, onSubmit }: { categories: ExpenseCategory[]; onClose: () => void; onSubmit: (data: ExpenseFormData) => void }) {
  const [form, setForm] = useState({ category_id: '', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ ...form, category_id: form.category_id ? parseInt(form.category_id) : null, amount: parseFloat(form.amount) }); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Expense</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS) *</label>
            <input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="">No category</option>
              {categories.map((c: ExpenseCategory) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition">Add Expense</button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({ categories, onClose, onCreate, onDelete }: { categories: ExpenseCategory[]; onClose: () => void; onCreate: (name: string) => void; onDelete: (id: number) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Manage Categories</h3>
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {categories.map((c: ExpenseCategory) => (
            <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-900">{c.name}</span>
              {!c.is_default && (
                <button onClick={() => onDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New category name"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none" />
          <button onClick={() => { if (name.trim()) { onCreate(name.trim()); setName(''); } }}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition">Add</button>
        </div>
        <button onClick={onClose} className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">Close</button>
      </div>
    </div>
  );
}
