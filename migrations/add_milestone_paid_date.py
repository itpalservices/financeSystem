"""
Migration script to add:
1. paid_date column to milestones table
2. partially_paid status to milestonestatus enum
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
            print("Adding partially_paid status to milestonestatus enum...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TYPE milestonestatus ADD VALUE IF NOT EXISTS 'partially_paid';
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            print("Adding paid_date column to milestones...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE milestones ADD COLUMN paid_date TIMESTAMP;
                EXCEPTION
                    WHEN duplicate_column THEN null;
                END $$;
            """))
            
            conn.execute(text("COMMIT;"))
            print("Migration completed successfully!")
            
        except Exception as e:
            conn.execute(text("ROLLBACK;"))
            print(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()
