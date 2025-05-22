# app2.py - New registration/login/OTP backend for newauth system
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import random
import string

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/steam_clone.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)
db = SQLAlchemy(app)

# --- Models ---
class User2(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    otp_code = db.Column(db.String(6))
    otp_expiry = db.Column(db.DateTime)

# --- Helpers ---
def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def send_otp_email(email, otp):
    print(f"[DEBUG] OTP for {email}: {otp}")
    # In production, send email here

# --- Routes ---
@app.route('/api2/register', methods=['POST'])
def register2():
    data = request.json
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')
    if not email or not username or not password:
        return jsonify({'error': 'All fields required.'}), 400
    if User2.query.filter((User2.email==email)|(User2.username==username)).first():
        return jsonify({'error': 'Email or username already exists.'}), 400
    otp = generate_otp()
    user = User2(email=email, username=username, password_hash=generate_password_hash(password), is_verified=False, otp_code=otp, otp_expiry=datetime.utcnow()+timedelta(minutes=10))
    db.session.add(user)
    db.session.commit()
    send_otp_email(email, otp)
    return jsonify({'message': 'Registered. OTP sent to email.'}), 200

@app.route('/api2/verify_otp', methods=['POST'])
def verify_otp2():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    user = User2.query.filter_by(email=email).first()
    if not user or not user.otp_code or not user.otp_expiry:
        return jsonify({'error': 'Invalid or expired OTP.'}), 400
    if user.otp_code != otp:
        return jsonify({'error': 'Invalid OTP.'}), 400
    if datetime.utcnow() > user.otp_expiry:
        return jsonify({'error': 'OTP expired.'}), 400
    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    db.session.commit()
    return jsonify({'message': 'Email verified.'}), 200

@app.route('/api2/login', methods=['POST'])
def login2():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    user = User2.query.filter_by(email=email).first()
    if not user or not user.is_verified:
        return jsonify({'error': 'Account not verified or does not exist.'}), 400
    if not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Incorrect password.'}), 400
    return jsonify({'message': 'Login successful.'}), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
