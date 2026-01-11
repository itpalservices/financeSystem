"""
Migration script to add:
1. customer_id, context_type, pdf_stored columns to invoices
2. customer_id, context_type, project_id, milestone_id, pdf_stored columns to quotes
3. payment_receipts table
4. audit_logs table
5. Backfill customer_id based on telephone1 matching
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        conn.execute(text("BEGIN;"))
        
        try:
            print("Creating context_type enum...")
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE contexttype AS ENUM ('none', 'project');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            print("Creating receipt_status enum...")
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE receiptstatus AS ENUM ('draft', 'issued', 'cancelled');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            print("Creating payment_method enum...")
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE paymentmethod AS ENUM ('cash', 'bank_transfer', 'card', 'cheque', 'other');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            print("Adding customer_id column to invoices...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE invoices ADD COLUMN customer_id INTEGER REFERENCES customers(id);
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding context_type column to invoices...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE invoices ADD COLUMN context_type contexttype DEFAULT 'none';
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding pdf_stored column to invoices...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE invoices ADD COLUMN pdf_stored VARCHAR;
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding customer_id column to quotes...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE quotes ADD COLUMN customer_id INTEGER REFERENCES customers(id);
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding context_type column to quotes...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE quotes ADD COLUMN context_type contexttype DEFAULT 'none';
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding project_id column to quotes...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE quotes ADD COLUMN project_id INTEGER REFERENCES projects(id);
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding milestone_id column to quotes...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE quotes ADD COLUMN milestone_id INTEGER REFERENCES milestones(id);
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Adding pdf_stored column to quotes...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE quotes ADD COLUMN pdf_stored VARCHAR;
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            print("Creating payment_receipts table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS payment_receipts (
                    id SERIAL PRIMARY KEY,
                    receipt_number VARCHAR UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    customer_id INTEGER REFERENCES customers(id),
                    client_name VARCHAR,
                    company_name VARCHAR,
                    client_email VARCHAR,
                    telephone1 VARCHAR,
                    telephone2 VARCHAR,
                    client_address TEXT,
                    client_reg_no VARCHAR,
                    client_tax_id VARCHAR,
                    context_type contexttype DEFAULT 'none' NOT NULL,
                    project_id INTEGER REFERENCES projects(id),
                    milestone_id INTEGER REFERENCES milestones(id),
                    invoice_id INTEGER REFERENCES invoices(id),
                    status receiptstatus DEFAULT 'draft' NOT NULL,
                    receipt_date TIMESTAMP DEFAULT NOW(),
                    payment_method paymentmethod DEFAULT 'bank_transfer' NOT NULL,
                    payment_reference VARCHAR,
                    amount FLOAT DEFAULT 0.0,
                    notes TEXT,
                    pdf_url VARCHAR,
                    pdf_stored VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    issued_at TIMESTAMP,
                    issued_by INTEGER REFERENCES users(id),
                    cancelled_at TIMESTAMP,
                    cancelled_by INTEGER REFERENCES users(id),
                    cancel_reason TEXT,
                    customer_snapshot JSONB
                );
            """))
            
            print("Creating index on payment_receipts.receipt_number...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_payment_receipts_receipt_number ON payment_receipts(receipt_number);
            """))
            
            print("Creating index on payment_receipts.customer_id...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_payment_receipts_customer_id ON payment_receipts(customer_id);
            """))
            
            print("Creating audit_logs table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    username VARCHAR,
                    action VARCHAR NOT NULL,
                    entity_type VARCHAR,
                    entity_id INTEGER,
                    entity_number VARCHAR,
                    description TEXT,
                    old_values JSONB,
                    new_values JSONB,
                    ip_address VARCHAR,
                    user_agent VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
            
            print("Creating indexes on audit_logs...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs(entity_type);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
            """))
            
            print("Creating index on invoices.customer_id...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_invoices_customer_id ON invoices(customer_id);
            """))
            
            print("Creating index on quotes.customer_id...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_quotes_customer_id ON quotes(customer_id);
            """))
            
            print("Backfilling customer_id for invoices based on telephone1 matching...")
            conn.execute(text("""
                UPDATE invoices i
                SET customer_id = c.id
                FROM customers c
                WHERE i.telephone1 = c.telephone1
                AND i.customer_id IS NULL
                AND i.telephone1 IS NOT NULL;
            """))
            
            print("Backfilling customer_id for quotes based on telephone1 matching...")
            conn.execute(text("""
                UPDATE quotes q
                SET customer_id = c.id
                FROM customers c
                WHERE q.telephone1 = c.telephone1
                AND q.customer_id IS NULL
                AND q.telephone1 IS NOT NULL;
            """))
            
            print("Setting context_type to 'project' for invoices with project_id...")
            conn.execute(text("""
                UPDATE invoices
                SET context_type = 'project'
                WHERE project_id IS NOT NULL;
            """))
            
            conn.execute(text("COMMIT;"))
            print("Migration completed successfully!")
            
        except Exception as e:
            conn.execute(text("ROLLBACK;"))
            print(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()
