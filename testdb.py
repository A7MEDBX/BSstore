from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from supabase import create_client, Client

app = Flask(__name__)

# استخدم بياناتك الحقيقية
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:A7MEDBX%40BSSTORE@db.ibelidjmkkwacgqtkvcb.supabase.co:5432/postgres'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# جدول تجريبي
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))

# تجربة الاتصال وإنشاء الجدول
@app.route('/')
def index():
    try:
        db.create_all()
        return '✅ Successfully connected to the database and created tables.'
    except Exception as e:
        return f'❌ Error: {e}'

SUPABASE_URL = "https://ibelidjmkkwacgqtkvcb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZWxpZGpta2t3YWNncXRrdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODU2MzMsImV4cCI6MjA2MjQ2MTYzM30.DKO3dhO4ha1jzZMaQfhpfzeFzahK1HjsTeSPcctgVzE"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/supabase-test')
def supabase_test():
    try:
        # Example: fetch all users from 'users' table
        response = supabase.table('user').select('*').execute()
        return f"✅ Supabase connected. Users: {response.data}"
    except Exception as e:
        return f"❌ Supabase error: {e}"

if __name__ == '__main__':
    app.run(debug=True)
