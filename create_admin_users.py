#!/usr/bin/env python3
"""
Script to create admin users for I.T. PAL Invoice & Quote System

This script creates 3 admin users with the following credentials:
- spyros.l@itpal.com / password: 123
- manolis.p@itpal.com / password: 123
- nicolas.ch@itpal.com / password: 123

The password is hashed using bcrypt before storing in the database.
"""

import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, Base, engine
from app.auth import get_password_hash

Base.metadata.create_all(bind=engine)

from app.models.user import User

def create_admin_users():
    db = SessionLocal()
    try:
        admin_users = [
            {"email": "spyros.l@itpal.com", "password": "123", "role": "admin"},
            {"email": "manolis.p@itpal.com", "password": "123", "role": "admin"},
            {"email": "nicolas.ch@itpal.com", "password": "123", "role": "admin"},
        ]
        
        for user_data in admin_users:
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            if existing_user:
                print(f"User {user_data['email']} already exists. Skipping...")
                continue
            
            hashed_password = get_password_hash(user_data["password"])
            
            new_user = User(
                email=user_data["email"],
                hashed_password=hashed_password,
                role=user_data["role"]
            )
            
            db.add(new_user)
            print(f"Created admin user: {user_data['email']}")
        
        db.commit()
        print("\nAll admin users created successfully!")
        print("\nPassword Hashing Information:")
        print("=" * 60)
        print("The system uses bcrypt for password hashing.")
        print("To manually change a password, you can use Python:")
        print()
        print("  from app.auth import get_password_hash")
        print("  hashed = get_password_hash('your_new_password')")
        print("  print(hashed)")
        print()
        print("Then update the database:")
        print("  UPDATE users SET hashed_password = '<hashed_value>'")
        print("  WHERE email = 'user@example.com';")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating admin users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_users()
