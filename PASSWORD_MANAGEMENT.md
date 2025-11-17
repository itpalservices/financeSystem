# Password Management for I.T. PAL Invoice & Quote System

## Admin Users Created

The following admin users have been created with password `123`:

- **Username: spyros.l** (Email: spyros.l@itpal.com)
- **Username: manolis.p** (Email: manolis.p@itpal.com)
- **Username: nicolas.ch** (Email: nicolas.ch@itpal.com)

**Login with username, not email!**

## Password Hashing

The system uses **bcrypt** for password hashing. Bcrypt is a secure, one-way hash function that includes:
- Salt generation for each password
- Configurable work factor (cost)
- Protection against rainbow table attacks

## Changing Passwords Manually

### Method 1: Using Python (Recommended)

1. Access the Python environment where the application is running
2. Run the following commands:

```python
import bcrypt

# Generate a new password hash
new_password = "your_new_password_here"
hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
print(hashed.decode('utf-8'))
```

3. Copy the output hash (it will look like: `$2b$12$...`)

4. Update the database using SQL:

```sql
UPDATE users 
SET hashed_password = '$2b$12$...' 
WHERE email = 'user@itpal.com';
```

### Method 2: Using Online Bcrypt Generator

1. Visit a trusted bcrypt generator (e.g., bcrypt-generator.com)
2. Enter your new password
3. Set rounds to **12** (default)
4. Copy the generated hash
5. Update the database using the SQL command above

### Example

To change the password for `spyros.l@itpal.com` to `newpassword123`:

```python
import bcrypt
password = "newpassword123"
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
print(hashed.decode('utf-8'))
# Output: $2b$12$abc123def456...
```

Then update:
```sql
UPDATE users 
SET hashed_password = '$2b$12$abc123def456...' 
WHERE email = 'spyros.l@itpal.com';
```

## Security Best Practices

1. **Never store plain text passwords** - Always use bcrypt hashes
2. **Use strong passwords** - Minimum 8 characters with mixed case, numbers, and symbols
3. **Change default passwords** - Update the default `123` password immediately in production
4. **Protect database access** - Limit who can view or modify the users table
5. **Use environment variables** - Store JWT secret keys in environment variables

## Current Password Hash

The current hash for password `123` is:
```
$2b$12$eGwnuOjqgo9DaQR2zAVFSe7Xl8UETyHshemaeG9bEhjRL.FRRRakq
```

**⚠️ WARNING**: This is a weak password and should only be used for initial setup. Change it immediately for production use!

## Verifying Passwords

To verify if a password matches a hash:

```python
import bcrypt

password = "123"
stored_hash = "$2b$12$eGwnuOjqgo9DaQR2zAVFSe7Xl8UETyHshemaeG9bEhjRL.FRRRakq"

if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
    print("Password matches!")
else:
    print("Password does not match.")
```

## Technical Details

- **Algorithm**: bcrypt
- **Cost Factor**: 12 (2^12 iterations)
- **Salt**: Automatically generated per password
- **Hash Format**: `$2b$[cost]$[salt][hash]`
- **Maximum Password Length**: 72 bytes (truncated if longer)

## Quick Reference Commands

```bash
# Generate hash using Python
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your_password', bcrypt.gensalt()).decode())"

# Check database users
psql $DATABASE_URL -c "SELECT id, email, role FROM users;"

# Update password
psql $DATABASE_URL -c "UPDATE users SET hashed_password = '\$2b\$12\$...' WHERE email = 'user@itpal.com';"
```
