import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'data', 'photo-dashboard.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker' CHECK(role IN ('owner', 'worker')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      skills TEXT NOT NULL DEFAULT 'photographer' CHECK(skills IN ('photographer', 'retoucher', 'both')),
      rate_per_gig REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS gigs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      gig_date DATE NOT NULL,
      location TEXT,
      description TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      photographer_split REAL DEFAULT 30,
      retoucher_split REAL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      invoice_reference TEXT,
      zoho_invoice_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gig_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gig_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('photographer', 'retoucher')),
      custom_split REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gig_id INTEGER,
      invoice_number TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('zoho', 'manual')),
      zoho_invoice_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS client_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gig_id INTEGER NOT NULL,
      invoice_id INTEGER,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'card', 'other')),
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS worker_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gig_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'card', 'other')),
      reference_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      gig_id INTEGER,
      receipt_reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS zoho_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      client_id TEXT,
      client_secret TEXT,
      refresh_token TEXT,
      organization_id TEXT,
      region TEXT DEFAULT 'com',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_gigs_date ON gigs(gig_date);
    CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs(status);
    CREATE INDEX IF NOT EXISTS idx_client_payments_gig ON client_payments(gig_id);
    CREATE INDEX IF NOT EXISTS idx_worker_payments_gig ON worker_payments(gig_id);
    CREATE INDEX IF NOT EXISTS idx_worker_payments_worker ON worker_payments(worker_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  `);

  // Seed default expense categories
  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO expense_categories (name, is_default) VALUES (?, 1)'
  );
  const defaultCategories = [
    'Transport', 'Equipment', 'Props', 'Studio Rent', 'Editing Software',
    'Internet', 'Printing', 'Marketing', 'Utilities', 'Miscellaneous'
  ];
  for (const cat of defaultCategories) {
    insertCategory.run(cat);
  }

  // Seed default owner account (password: admin123)
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT OR IGNORE INTO users (email, name, password, role) VALUES (?, ?, ?, ?)'
  ).run('admin@photo.com', 'Business Owner', hashedPassword, 'owner');
}

export default getDb;
