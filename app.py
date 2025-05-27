# --- IMPORTANT: JWT AUTH ---
# All protected endpoints require the frontend to send:
#   Authorization: Bearer <JWT_TOKEN>
# in the request headers. Cookies are NOT used for JWT auth.
#
# Example (JS fetch):
# fetch('/api/some-protected-endpoint', {
#   headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
# })
#
# If you get 401 errors, check that the header is present and the token is valid.
#
# --- END IMPORTANT ---

from flask import Flask, request, jsonify
import secrets
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
from datetime import datetime, timedelta
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
from werkzeug.utils import secure_filename
import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from flask_swagger_ui import get_swaggerui_blueprint
import random
from supabase import create_client, Client

app = Flask(__name__)
CORS(app)

# --- SUPABASE CONNECTION ---
SUPABASE_URL = "https://ibelidjmkkwacgqtkvcb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZWxpZGpta2t3YWNncXRrdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODU2MzMsImV4cCI6MjA2MjQ2MTYzM30.DKO3dhO4ha1jzZMaQfhpfzeFzahK1HjsTeSPcctgVzE"  # Replace with your actual Supabase service role key
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print('DEBUG: SUPABASE_URL =', SUPABASE_URL)
# --- END SUPABASE CONNECTION ---

# --- APP CONFIGURATION ---

mail = Mail(app)

# Configure Flask-Mail (update with your SMTP server details)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'bsgamingstors@gmail.com'
app.config['MAIL_PASSWORD'] = 'qysj pcmd tkvd tvxn'
app.config['MAIL_DEFAULT_SENDER'] = 'bsgamingstors@gmail.com'
mail.init_app(app)

CORS(app, supports_credentials=True,
     origins=[
         "http://localhost:7000", "http://127.0.0.1:7000",
         "http://localhost:5000", "http://127.0.0.1:5000",
         "http://localhost:3000", "http://127.0.0.1:3000",
         "http://localhost:5500", "http://127.0.0.1:5500",
         "http://localhost:5700", "http://127.0.0.1:5700",
         "http://localhost", "http://127.0.0.1",
         "https://bsstore.netlify.app"  # Added Netlify frontend for CORS
     ],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH","PATCH"])

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per minute"]
)

JWT_SECRET = 'your_jwt_secret_key'  # Change this to a secure value in production
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 3600  # 1 hour

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'images', 'game')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

cloudinary.config(
    cloud_name = "dy2iusd5v",
    api_key = "265254881435885",
    api_secret = "Fj3Vqd04YIlHRKqZmIIr_ns6Oyw",
    secure=True
)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper: Create JWT token
def create_jwt_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Helper: Decode JWT token
def decode_jwt_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# --- JWT BLACKLIST SETUP ---
jwt_blacklist = set()  # In production, use Redis or DB

# Helper: Get token from header
def get_token_from_header():
    auth_header = request.headers.get('Authorization', None)
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ')[1]

# Update login_required to check blacklist
def get_user_by_id_supabase(user_id):
    """Helper to fetch a user from Supabase by ID."""
    try:
        # Use the 'user' table (singular)
        response = supabase.table('user').select('*').eq('id', user_id).maybe_single().execute()
        
        # Important: Check for errors during fetch
        if getattr(response, 'error', None):
            print(f"Supabase error fetching user {user_id}: {response.error.message}")
            return None
            
        return response.data # Will be the user dictionary or None
    except Exception as e:
        print(f"Python Error fetching user {user_id}: {e}")
        traceback.print_exc() # Print full traceback for debugging
        return None

# --- THIS IS THE CORRECT SUPABASE VERSION ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print("\n--- ENTERING @login_required (Supabase Version) ---") # Logging
        token = get_token_from_header()
        print(f"Token from header: {token}") # Logging

        if not token:
            print("FAIL: No token or bad format.") # Logging
            return jsonify({'error': 'Authorization header missing or invalid'}), 401

        if token in jwt_blacklist:
            print(f"FAIL: Token {token} is blacklisted.") # Logging
            return jsonify({'error': 'Token has been revoked. Please log in again.'}), 401

        user_id = decode_jwt_token(token)
        print(f"Decoded User ID: {user_id}") # Logging

        if not user_id:
            print("FAIL: Invalid or expired token.") # Logging
            return jsonify({'error': 'Invalid or expired token'}), 401

        # --- THIS IS THE KEY CHANGE ---
        # Fetch user from Supabase, not SQLAlchemy
        user = get_user_by_id_supabase(user_id) 
        print(f"User from Supabase: {user}") # Logging
        # --- END KEY CHANGE ---

        if not user:
            print(f"FAIL: User ID {user_id} not found in DB.") # Logging
            return jsonify({'error': 'User not found.'}), 401

        print("--- SUCCESS: User Authenticated ---") # Logging
        # Set both user_id and the full user dictionary for other routes
        request.user_id = user_id
        request.user = user  # <-- This is important for /api/me
        return f(*args, **kwargs)
    return decorated_function
# Decorator: Rate limit
# Helper: Role-based access decorator
def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = User.query.get(request.user_id)
            if not user or user.role not in roles:
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/')
def home():
    return "Welcome to your Steam-like platform!"

@app.route('/verify.html')
def serve_verify_html():
    return app.send_static_file('verify.html')

# User APIs
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        response = supabase.table('user').select('*').execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    """
    Creates a new user in Supabase. 
    NOTE: This is DIFFERENT from /api/register. It expects a password 
    (and hashes it) but does NOT send an OTP verification email. 
    Consider if /api/register is more appropriate for general use.
    This endpoint assumes the input contains 'password', not 'password_hash'.
    """
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password') # Expecting 'password', will hash it.

        # --- Input Validation ---
        if not all([username, email, password]):
            return jsonify({'error': 'Username, email, and password are required.'}), 400

        # --- Check if user exists ---
        check_response = supabase.table('user').select('id').or_(f"username.eq.{username},email.eq.{email}").execute()
        
        if check_response.error:
             print(f"Supabase Error checking user: {check_response.error.message}")
             return jsonify({'error': 'Database error checking user', 'details': check_response.error.message}), 500

        if check_response.data:
            return jsonify({'error': 'Username or email already exists.'}), 400

        # --- Hash the password ---
        hashed_password = generate_password_hash(password)

        # --- Prepare user data for Supabase ---
        user_data = {
            'username': username,
            'email': email,
            'password_hash': hashed_password,
            'is_verified': data.get('is_verified', False), # Default to False unless specified
            'role': data.get('role', 'user') # Default to 'user' role
            # Add any other default fields needed for your 'users' table
        }

        # --- Insert user into Supabase ---
        insert_response = supabase.table('user').insert(user_data).execute()

        if insert_response.error:
            print(f"Supabase Error creating user: {insert_response.error.message}")
            return jsonify({'error': 'Failed to create user', 'details': insert_response.error.message}), 500

        if not insert_response.data:
            return jsonify({'error': 'Failed to create user, no data returned.'}), 500
            
        # --- User created, now log history ---
        user = insert_response.data[0]
        user_id = user.get('id')
        username = user.get('username')

        history_data = {
            'user_id': user_id,
            'action': 'account_created',
            'details': f'User {username} created an account.'
            # 'timestamp' will usually be set by default in Supabase (now())
        }
        
        # Insert history (best effort, don't fail user creation if this fails)
        history_response = supabase.table('userhistory').insert(history_data).execute()
        if history_response.error:
            print(f"Warning: User {user_id} created, but failed to log history: {history_response.error.message}")

        # --- Return success response ---
        return jsonify({'id': user_id, 'username': username, 'email': user.get('email')}), 201

    except Exception as e:
        # Catch any other unexpected Python errors.
        print("Flask/Python Error creating user:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
      
@app.route('/api/allgames', methods=['GET'])
def allgames():
    try:
        response = supabase.table('game').select('*').execute()
        games = response.data
        return jsonify([
            {
                'id': g.get('id'),
                'title': g.get('title'),
                'description': g.get('description'),
                'developer': g.get('developer'),
                'publisher': g.get('publisher'),
                'release_date': g.get('release_date'),
                'image_url': g.get('image_url'),
                'download_url': g.get('download_url'),
                'approved': g.get('approved'),
                'status': g.get('status'),
                'price': g.get('price'),
                'genre': g.get('genre')
            } for g in games
        ])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Game APIs

from flask import Flask, jsonify, request
from supabase import create_client, Client
import traceback

# --- (Assuming app and supabase are defined) ---

# --- GET APPROVED GAMES LIST ---
@app.route('/api/games', methods=['GET'])
def get_games():
    """
    Fetches a list of games from the 'game' table WHERE 'approved' is True.
    """
    try:
        # Use 'game' table and filter for approved.
        response = supabase.table('game').select('*').eq('approved', True).execute()

       
        # Check for Supabase errors FIRST
        if getattr(response, 'error', None):
            print(f"Supabase Error: {response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500
            
        # If no error, return the data (or an empty list if no approved games found)
        return jsonify(response.data or []), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

# --- GET SINGLE GAME BY ID ---
@app.route('/api/games/<int:game_id>', methods=['GET'])
def get_game_details(game_id): # Renamed for consistency
    """
    Fetch a single game by ID from the 'game' table.
    """
    try:
        # Use 'game' table and filter by id.
        response = supabase.table('game').select('*').eq('id', game_id).execute()

        print(f"--- Supabase Response for /api/games/{game_id} ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}") # Safely check for error
        print("-----------------------------------------")

        # Check for Supabase errors FIRST
        if getattr(response, 'error', None):
            print(f"Supabase Error: {response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        # Check if data exists and is not empty
        if response.data:
            game = response.data[0]
            # Return the single game dictionary
            return jsonify(game), 200
        else:
            # No data found, return 404
            return jsonify({'error': 'Game not found'}), 404
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
# Company uploads a game (pending approval)
@app.route('/api/games', methods=['POST'])
@login_required
@role_required('admin')
def create_game():
    try:
        data = request.json
        # Parse release_date as a Python date object if provided
        release_date = data.get('release_date')
        if release_date:
            try:
                release_date = datetime.strptime(release_date, '%Y-%m-%d').date().isoformat()
            except Exception:
                return jsonify({'error': 'release_date must be in YYYY-MM-DD format'}), 400

        game_data = {
            'title': data.get('title'),
            'description': data.get('description'),
            'developer': data.get('developer'),
            'publisher': data.get('publisher'),
            'release_date': release_date,
            'image_url': data.get('image_url'),
            'download_url': data.get('download_url'),
            'approved': True,
            'status': data.get('status', 'draft'),
            'price': data.get('price')
        }

        response = supabase.table('game').insert(game_data).execute()
        if response.get('status_code', 200) >= 400:
            return jsonify({'error': 'Failed to create game'}), 500
            
        created_game = response.get('data', [{}])[0]
        return jsonify({
            'id': created_game.get('id'),
            'title': created_game.get('title'),
            'message': 'Game created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Admin approves a game
@app.route('/api/games/<int:game_id>/approve', methods=['POST'])
@login_required
@role_required('admin')
def approve_game(game_id):
    try:
        response = supabase.table('games').update({'approved': True}).eq('id', game_id).execute()
        if response.get('status_code', 200) >= 400:
            return jsonify({'error': 'Failed to approve game'}), 500
            
        updated_game = response.get('data', [{}])[0]
        return jsonify({'id': updated_game.get('id'), 'approved': updated_game.get('approved')})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin deletes a game
@app.route('/api/games/<int:game_id>', methods=['DELETE'])
@login_required
@role_required('admin')
def delete_game(game_id):
    game = Game.query.get_or_404(game_id)
    db.session.delete(game)
    db.session.commit()
    return jsonify({'result': 'Game deleted successfully.'})

# --- GameImage Model for Multiple Images per Game ---
# Add image (upload to Cloudinary)
@app.route('/api/games/<int:game_id>/images', methods=['POST'])
@login_required
@role_required('company')
def add_game_image(game_id):
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided.'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400
    if file and allowed_file(file.filename):
        upload_result = cloudinary.uploader.upload(file, public_id=f"game_{game_id}_{file.filename}")
        image_url = upload_result["secure_url"]
        game_image = GameImage(game_id=game_id, image_url=image_url)
        db.session.add(game_image)
        db.session.commit()
        return jsonify({'id': game_image.id, 'image_url': game_image.image_url}), 201
    return jsonify({'error': 'Invalid file type.'}), 400

# List all images for a game
@app.route('/api/games/<int:game_id>/images', methods=['GET'])
def list_game_images(game_id):
    images = GameImage.query.filter_by(game_id=game_id).all()
    return jsonify([{'id': img.id, 'image_url': img.image_url} for img in images])

# Edit (replace) an image
@app.route('/api/games/images/<int:image_id>', methods=['PUT'])
@login_required
@role_required('company')
def edit_game_image(image_id):
    game_image = GameImage.query.get_or_404(image_id)
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided.'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400
    if file and allowed_file(file.filename):
        # Optionally: delete old image from Cloudinary here
        upload_result = cloudinary.uploader.upload(file, public_id=f"game_{game_image.game_id}_{file.filename}", overwrite=True)
        image_url = upload_result["secure_url"]
        game_image.image_url = image_url
        db.session.commit()
        return jsonify({'id': game_image.id, 'image_url': game_image.image_url}), 200
    return jsonify({'error': 'Invalid file type.'}), 400

# Delete an image
@app.route('/api/games/images/<int:image_id>', methods=['DELETE'])
@login_required
@role_required('company')
def delete_game_image(image_id):
    game_image = GameImage.query.get_or_404(image_id)
    # Optionally: delete from Cloudinary using public_id
    db.session.delete(game_image)
    db.session.commit()
    return jsonify({'result': 'Image deleted successfully.'})

# Category APIs
@app.route('/api/categories', methods=['GET'])
def get_categories():
    try:
        categories = Category.query.all()
        return jsonify([{'id': c.id, 'name': c.name} for c in categories])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/categories', methods=['POST'])
def create_category():
    try:
        data = request.json
        category = Category(name=data['name'])
        db.session.add(category)
        db.session.commit()
        return jsonify({'id': category.id, 'name': category.name}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Purchase APIs
@app.route('/api/purchases', methods=['GET'])
def get_purchases():
    try:
        purchases = Purchase.query.all()
        return jsonify([{'id': p.id, 'user_id': p.user_id, 'game_id': p.game_id, 'price': p.price} for p in purchases])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/purchases', methods=['POST'])
def create_purchase():
    data = request.json
    user_id = data['user_id']
    game_id = data['game_id']
    price = data.get('price')
    payment_method_id = data.get('payment_method_id')
    payment_details = data.get('payment_details')  # dict with new payment info if provided

    from models import PaymentMethod

    # Use existing payment method or save new one
    if payment_method_id:
        payment_method = PaymentMethod.query.filter_by(id=payment_method_id, user_id=user_id).first()
        if not payment_method:
            return jsonify({'error': 'Payment method not found.'}), 400
    elif payment_details:
        # Save new payment method for user
        method_type = payment_details.get('method_type')
        card_last4 = payment_details.get('card_last4')
        card_expiry = payment_details.get('card_expiry')
        card_brand = payment_details.get('card_brand')
        paypal_email = payment_details.get('paypal_email')
        details_encrypted = payment_details.get('details_encrypted')  # In production, encrypt sensitive info
        payment_method = PaymentMethod(
            user_id=user_id,
            method_type=method_type,
            card_last4=card_last4,
            card_expiry=card_expiry,
            card_brand=card_brand,
            paypal_email=paypal_email,
            details_encrypted=details_encrypted,
            is_default=True  # Optionally set as default
        )
        db.session.add(payment_method)
        db.session.commit()
    else:
        return jsonify({'error': 'No payment method provided.'}), 400

    purchase = Purchase(user_id=user_id, game_id=game_id, price=price)
    db.session.add(purchase)
    db.session.commit()
    # Add to user library
    entry = UserLibrary(user_id=user_id, game_id=game_id)
    db.session.add(entry)
    db.session.commit()
    # Log history
    from models import UserHistory
    history = UserHistory(user_id=user_id, action='purchase', details=f'User purchased game_id={game_id}')
    db.session.add(history)
    db.session.commit()
    # Send thank you email
    user_obj = User.query.get(user_id)
    game_obj = Game.query.get(game_id)
    if user_obj and game_obj:
        thank_msg = Message('Thank you for your purchase!', recipients=[user_obj.email])
        thank_msg.html = f'''
        <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                <h2 style="color:#1ba9ff;margin-bottom:18px;">Thank You for Your Purchase!</h2>
                <img src="{game_obj.image_url or 'https://via.placeholder.com/120x160?text=No+Image'}" alt="{game_obj.title}" style="width:120px;height:160px;object-fit:cover;border-radius:8px;margin-bottom:18px;"/>
                <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">{game_obj.title}</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Thank you, {user_obj.username}, for purchasing <b>{game_obj.title}</b> from us! Enjoy your game.</div>
                <a href="http://localhost:5000/game.html?id={game_obj.id}" style="display:inline-block;margin-top:12px;padding:12px 32px;background:linear-gradient(90deg,#1ba9ff 0,#3b7cff 100%);color:#fff;border-radius:8px;font-size:1.1rem;font-weight:600;text-decoration:none;">View Game</a>
            </div>
        </div>
        '''
        mail.send(thank_msg)
    return jsonify({'id': purchase.id, 'user_id': purchase.user_id, 'game_id': purchase.game_id, 'payment_method_id': payment_method.id}), 201

# Review APIs
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    try:
        reviews = Review.query.all()
        return jsonify([{'id': r.id, 'user_id': r.user_id, 'game_id': r.game_id, 'rating': r.rating, 'comment': r.comment} for r in reviews])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reviews', methods=['POST'])
def create_review():
    data = request.json
    review = Review(user_id=data['user_id'], game_id=data['game_id'], rating=data.get('rating'), comment=data.get('comment'))
    db.session.add(review)
    db.session.commit()
    return jsonify({'id': review.id}), 201

# UserLibrary APIs


# --- (Assuming app, supabase, and login_required decorator are defined) ---
# Your @login_required decorator must be working and setting request.user_id
# and request.user correctly.
# ---

@app.route('/api/userlibrary', methods=['GET'])
@login_required
def get_userlibrary():
    """
    Fetches the game library for the authenticated user, including game details.
    Assumes a foreign key relationship exists from 'user_library.game_id' to 'game.id'
    for the game(*) join to work effectively.
    """
    try:
        user_id = request.user_id

        # Fetch user_library entries and join with the 'game' table.
        response = supabase.table('user_library').select('*, game(*)').eq('user_id', user_id).execute()

        print(f"--- Supabase Response for /api/userlibrary GET (User ID: {user_id}) ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-----------------------------------------------------------------")

        if getattr(response, 'error', None):
            print(f"Supabase Error: {response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        library_items = []
        if response.data:
            for entry in response.data:
                game_details = entry.get('game') 
                if game_details:
                    library_items.append({
                        'id': game_details.get('id'), 
                        'title': game_details.get('title'),
                        'image_url': game_details.get('image_url'),
                        'download_url': game_details.get('download_url'),
                        'playtime': entry.get('playtime'), 
                        'acquisition_date': entry.get('acquisition_date'),
                        'achievements': 0, 
                        'addon': None,
                    })
        
        return jsonify(library_items), 200

    except Exception as e:
        print(f"Flask/Python Error in /api/userlibrary GET for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

@app.route('/api/userlibrary', methods=['POST'])
@login_required
def create_userlibrary():
    """
    Adds a game to the authenticated user's library.
    Assumes 'id' in 'user_library' is an auto-generated IDENTITY column in Supabase.
    """
    try:
        data = request.json
        user_id = request.user_id 
        game_id = data.get('game_id')
        playtime = data.get('playtime', 0) 

        if not game_id:
            return jsonify({'error': 'game_id is required.'}), 400

        # Prevent duplicate
        check_response = supabase.table('user_library').select('id', count='exact').eq('user_id', user_id).eq('game_id', game_id).execute()

        if getattr(check_response, 'error', None):
            print(f"Supabase Error checking library: {check_response.error.message}")
            return jsonify({'error': 'Database error checking library', 'details': check_response.error.message}), 500
        
        if check_response.count > 0:
            return jsonify({'error': 'You already own this game in your library.'}), 409

        entry_data = {
            'user_id': user_id,
            'game_id': game_id,
            'playtime': playtime,
            'acquisition_date': datetime.now(timezone.utc).isoformat()
        }

        insert_response = supabase.table('user_library').insert(entry_data).execute()

        if getattr(insert_response, 'error', None):
            # This is where you'd see the error if 'id' wasn't identity or other constraint violation
            print(f"Supabase Error adding to library: {insert_response.error.message}")
            return jsonify({'error': 'Failed to add game to library', 'details': insert_response.error.message}), 500

        if not insert_response.data:
             return jsonify({'error': 'Failed to add game to library, no data returned.'}), 500
        
        return jsonify(insert_response.data[0]), 201

    except Exception as e:
        print(f"Flask/Python Error in /api/userlibrary POST for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
  
    """
    Adds a game to the authenticated user's library.
    Assumes 'id' in 'user_library' is auto-generated by Supabase.
    """
    try:
        data = request.json
        user_id = request.user_id # Set by @login_required
        game_id = data.get('game_id')
        playtime = data.get('playtime', 0) # Default playtime to 0 if not provided

        if not game_id:
            return jsonify({'error': 'game_id is required.'}), 400

        # --- Prevent duplicate: check if already in library ---
        check_response = supabase.table('user_library').select('id').eq('user_id', user_id).eq('game_id', game_id).execute()

        if getattr(check_response, 'error', None):
            print(f"Supabase Error checking library: {check_response.error.message}")
            return jsonify({'error': 'Database error checking library', 'details': check_response.error.message}), 500
        
        if check_response.data:
            return jsonify({'error': 'You already own this game in your library.'}), 409 # 409 Conflict

        # --- Prepare data for insertion ---
        # 'id' should be auto-generated by Supabase if "Is Identity" is enabled.
        # 'acquisition_date' can be set by the database default (e.g., now()) or here.
        entry_data = {
            'user_id': user_id,
            'game_id': game_id,
            'playtime': playtime,
            'acquisition_date': datetime.now(timezone.utc).isoformat() # Set current time
        }

        insert_response = supabase.table('user_library').insert(entry_data).execute()

        if getattr(insert_response, 'error', None):
            print(f"Supabase Error adding to library: {insert_response.error.message}")
            return jsonify({'error': 'Failed to add game to library', 'details': insert_response.error.message}), 500

        if not insert_response.data:
             return jsonify({'error': 'Failed to add game to library, no data returned.'}), 500

        # Return the newly created library entry (or just its ID)
        return jsonify(insert_response.data[0]), 201

    except Exception as e:
        print(f"Flask/Python Error in /api/userlibrary POST for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
# Friend APIs
@app.route('/api/friends', methods=['GET'])
@login_required
def get_friends():
    friends = Friend.query.all()
    return jsonify([{'id': f.id, 'user_id': f.user_id, 'friend_id': f.friend_id, 'status': f.status} for f in friends])

@app.route('/api/friends', methods=['POST'])
@login_required
def create_friend():
    data = request.json
    friend = Friend(user_id=data['user_id'], friend_id=data['friend_id'], status=data.get('status', 'pending'))
    db.session.add(friend)
    db.session.commit()
    return jsonify({'id': friend.id}), 201

@app.route('/api/friends/<int:friend_id>/accept', methods=['POST'])
@login_required
def accept_friend_request(friend_id):
    try:
        friend = Friend.query.get_or_404(friend_id)
        if friend.friend_id != request.user_id:
            return jsonify({'error': 'Not authorized.'}), 403
        friend.status = 'accepted'
        db.session.commit()
        return jsonify({'message': 'Friend request accepted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/friends/<int:friend_id>/reject', methods=['POST'])
@login_required
def reject_friend_request(friend_id):
    try:
        friend = Friend.query.get_or_404(friend_id)
        if friend.friend_id != request.user_id:
            return jsonify({'error': 'Not authorized.'}), 403
        db.session.delete(friend)
        db.session.commit()
        return jsonify({'message': 'Friend request rejected.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Wishlist APIs
@app.route('/api/wishlist', methods=['GET'])
@login_required
def get_wishlist():
    try:
        user_id = request.user_id
        wishes = Wishlist.query.filter_by(user_id=user_id).all()
        games = []
        for w in wishes:
            game = Game.query.get(w.game_id)
            if game:
                games.append({
                    'id': game.id,
                    'title': game.title,
                    'description': game.description,
                    'developer': game.developer,
                    'publisher': game.publisher,
                    'release_date': str(game.release_date) if game.release_date else None,
                    'image_url': game.image_url,
                    'price': game.price,
                    'genre': game.genre,
                    'pegi': getattr(game, 'pegi', 18),  # fallback if not present
                    'pegi_desc': getattr(game, 'pegi_desc', 'Violence'),
                    # Add more fields as needed
                })
        return jsonify(games)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wishlist', methods=['POST'])
@login_required
def create_wishlist():
    try:
        data = request.json
        user_id = request.user_id
        game_id = data.get('game_id')
        if not game_id:
            return jsonify({'error': 'game_id is required'}), 400
        # Prevent duplicate
        exists = Wishlist.query.filter_by(user_id=user_id, game_id=game_id).first()
        if exists:
            return jsonify({'error': 'Game already in wishlist.'}), 409
        wish = Wishlist(user_id=user_id, game_id=game_id)
        db.session.add(wish)
        db.session.commit()
        return jsonify({'id': wish.id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wishlist/<int:game_id>', methods=['DELETE'])
@login_required
def remove_from_wishlist(game_id):
    try:
        user_id = request.user_id
        wish = Wishlist.query.filter_by(user_id=user_id, game_id=game_id).first()
        if not wish:
            return jsonify({'error': 'Game not in wishlist.'}), 404
        db.session.delete(wish)
        db.session.commit()
        return jsonify({'message': 'Game removed from wishlist.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Achievement APIs
@app.route('/api/achievements', methods=['GET'])
@login_required
def get_achievements():
    try:
        achievements = Achievement.query.all()
        return jsonify([{'id': a.id, 'name': a.name, 'description': a.description} for a in achievements])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/achievements', methods=['POST'])
@login_required
def create_achievement():
    data = request.json
    achievement = Achievement(name=data['name'], description=data.get('description'))
    db.session.add(achievement)
    db.session.commit()
    return jsonify({'id': achievement.id}), 201

# Inventory APIs
@app.route('/api/inventory', methods=['GET'])
@login_required
def get_inventory():
    try:
        inventory = Inventory.query.all()
        return jsonify([{'id': i.id, 'user_id': i.user_id, 'game_id': i.game_id, 'item_type': i.item_type, 'item_name': i.item_name, 'trade_status': i.trade_status} for i in inventory])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory', methods=['POST'])
@login_required
def create_inventory():
    data = request.json
    item = Inventory(user_id=data['user_id'], game_id=data.get('game_id'), item_type=data.get('item_type'), item_name=data.get('item_name'), trade_status=data.get('trade_status'))
    db.session.add(item)
    db.session.commit()
    return jsonify({'id': item.id}), 201

# SupportTicket APIs
@app.route('/api/supporttickets', methods=['GET'])
@login_required
def get_supporttickets():
    try:
        tickets = SupportTicket.query.all()
        return jsonify([{'id': t.id, 'user_id': t.user_id, 'issue_type': t.issue_type, 'status': t.status, 'message': t.message} for t in tickets])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/supporttickets', methods=['POST'])
@login_required
def create_supportticket():
    data = request.json
    ticket = SupportTicket(user_id=data['user_id'], issue_type=data.get('issue_type'), status=data.get('status', 'open'), message=data.get('message'))
    db.session.add(ticket)
    db.session.commit()
    return jsonify({'id': ticket.id}), 201


from flask import Flask, request, jsonify
from supabase import create_client, Client
import traceback
from datetime import datetime, timezone # Make sure this is imported
from functools import wraps # For the @login_required decorator

# --- ASSUMPTIONS ---
# You have 'app' and 'supabase' client defined correctly.
# You have a working @login_required decorator that sets request.user_id.
# Example:
# app = Flask(__name__)
# SUPABASE_URL = "YOUR_SUPABASE_URL"
# SUPABASE_KEY = "YOUR_SUPABASE_SERVICE_KEY"
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
#
# def login_required(f):
#     @wraps(f)
#     def decorated_function(*args, **kwargs):
#         # ... your working @login_required logic using Supabase ...
#         # It must set request.user_id
#         # For example:
#         # token = get_token_from_header()
#         # if not token: return jsonify({'error': 'Auth header missing'}), 401
#         # user_id = decode_jwt_token(token) # Your function to decode
#         # if not user_id: return jsonify({'error': 'Invalid token'}), 401
#         # request.user_id = user_id 
#         return f(*args, **kwargs)
#     return decorated_function
# --- END ASSUMPTIONS ---

@app.route('/api/cart', methods=['GET'])
@login_required
def get_cart():
    """
    Fetches the cart items for the authenticated user, including game details.
    Assumes a foreign key relationship from 'cart_item.game_id' to 'game.id'.
    """
    try:
        user_id = request.user_id

        response = supabase.table('cart_item').select('id, game_id, added_at, game(*)').eq('user_id', user_id).execute()

        print(f"--- Supabase Response for GET /api/cart (User ID: {user_id}) ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-------------------------------------------------------------")

        if getattr(response, 'error', None):
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        result = []
        if response.data:
            for item in response.data:
                game_details = item.get('game')
                if game_details:
                    result.append({
                        'cart_item_id': item.get('id'),
                        'game_id': game_details.get('id'),
                        'title': game_details.get('title'),
                        'image': game_details.get('image_url'),
                        'price': game_details.get('price')
                    })
        
        return jsonify({'items': result}), 200

    except Exception as e:
        print(f"Flask/Python Error in GET /api/cart for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

@app.route('/api/cart', methods=['POST']) # <-- Ensure 'POST' is here
@login_required
def add_to_cart():
    """
    Adds a game to the authenticated user's cart.
    Assumes 'id' in 'cart_item' is auto-generated by Supabase ("Is Identity").
    """
    try:
        data = request.json
        user_id = request.user_id
        game_id = data.get('game_id')

        if not game_id:
            return jsonify({'error': 'game_id is required'}), 400

        # Check if already in user's library
        library_check_response = supabase.table('user_library').select('id', count='exact').eq('user_id', user_id).eq('game_id', game_id).execute()
        
        if getattr(library_check_response, 'error', None):
            return jsonify({'error': 'Database error checking library', 'details': library_check_response.error.message}), 500
        
        if library_check_response.count > 0:
            return jsonify({'error': 'You already own this game in your library.'}), 409

        # Check if already in cart
        cart_check_response = supabase.table('cart_item').select('id', count='exact').eq('user_id', user_id).eq('game_id', game_id).execute()

        if getattr(cart_check_response, 'error', None):
            return jsonify({'error': 'Database error checking cart', 'details': cart_check_response.error.message}), 500

        if cart_check_response.count > 0:
            return jsonify({'error': 'Game already in cart.'}), 400

        cart_item_data = {
            'user_id': user_id,
            'game_id': game_id,
            'added_at': datetime.now(timezone.utc).isoformat()
        }

        insert_response = supabase.table('cart_item').insert(cart_item_data).execute()

        if getattr(insert_response, 'error', None):
            print(f"Supabase Error adding to cart: {insert_response.error.message}")
            return jsonify({'error': 'Failed to add game to cart', 'details': insert_response.error.message}), 500
        
        if not insert_response.data:
             return jsonify({'error': 'Failed to add game to cart, no data returned (check if ID is auto-generated in Supabase for cart_item table).'}), 500

        return jsonify({'message': 'Game added to cart.', 'cart_item': insert_response.data[0]}), 201

    except Exception as e:
        print(f"Flask/Python Error in POST /api/cart for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/api/cart/<int:game_id>', methods=['DELETE'])
@login_required
def remove_from_cart(game_id):
    """
    Removes a game from the authenticated user's cart.
    Uses 'returning=representation' to confirm deletion.
    """
    try:
        user_id = request.user_id

        delete_response = supabase.table('cart_item').delete(returning='representation').match({'user_id': user_id, 'game_id': game_id}).execute()

        print(f"--- Supabase Response for DELETE /api/cart/{game_id} (User ID: {user_id}) ---")
        print(f"Data: {delete_response.data}")
        print(f"Error: {getattr(delete_response, 'error', 'N/A')}")
        print("-----------------------------------------------------------------------")

        if getattr(delete_response, 'error', None):
            return jsonify({'error': 'Failed to remove game from cart', 'details': delete_response.error.message}), 500

        if not delete_response.data:
             return jsonify({'error': 'Game not in cart or already removed.'}), 404
        
        return jsonify({'message': 'Game removed from cart.'}), 200

    except Exception as e:
        print(f"Flask/Python Error in DELETE /api/cart/{game_id} for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    # Input validation
    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required.'}), 400
    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Username or email already exists.'}), 400
    token = secrets.token_urlsafe(32)
    hashed_password = generate_password_hash(data['password'])
    user = User(username=data['username'], email=data['email'], password_hash=hashed_password, is_verified=False)
    db.session.add(user)
    db.session.commit()
    send_verification_email(user)
    return jsonify({'id': user.id, 'username': user.username, 'message': 'Verification OTP sent'}), 201

@app.route('/api/verify_otp', methods=['POST'])
def verify_email_otp():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not user.otp_code or not user.otp_expiry:
        return jsonify({'error': 'Invalid or expired OTP.'}), 400
    if user.otp_code != otp:
        return jsonify({'error': 'Invalid OTP.'}), 400
    if datetime.utcnow() > user.otp_expiry:
        return jsonify({'error': 'OTP has expired.'}), 400
    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    db.session.commit()
    # Send notification email after successful verification
    msg = Message('Registration Complete', recipients=[user.email])
    msg.html = f'''
    <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
            <h2 style="color:#1ba9ff;margin-bottom:18px;">Registration Complete</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Welcome, {user.username}!</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your email has been successfully verified and your registration is complete.</div>
        </div>
    </div>
    '''
    mail.send(msg)
    return jsonify({'message': 'Email verified successfully.'})


@app.route('/api/login', methods=['POST'])
def login():
    """
    Handles user login using the 'user' table.
    """
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    try:
        # Use the 'user' table (singular)
        response = supabase.table('user').select('*').eq('username', username).maybe_single().execute()

        print(f"--- Supabase Login Response for {username} ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-----------------------------------------")

        # Check if a user was found
        if not response.data:
            return jsonify({'error': 'Invalid credentials'}), 401

        user = response.data

        # Check the password_hash (ensure this column exists and is populated)
        if not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Check if verified (ensure this column exists)
        if not user.get('is_verified', False):
            return jsonify({'error': 'Email not verified.'}), 403
            
        # Check if active (ensure this column exists)
        if not user.get('is_active', True): # Default to True if column doesn't exist
            return jsonify({'error': 'Account is deactivated.'}), 403

        # Create JWT token
        token = create_jwt_token(user['id'])
        
        # Return token and user info
        return jsonify({
            'token': token, 
            'id': user['id'], 
            'username': user['username'], 
            'role': user.get('role', 'user'), 
            'avatar_url': user.get('avatar_url')
        })

    except Exception as e:
        print("Flask/Python Error during login:")
        traceback.print_exc() # Print the full error!
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

# --- LOGOUT ENDPOINT ---
@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    token = get_token_from_header()
    jwt_blacklist.add(token)
    return jsonify({'message': 'Logged out successfully. Please log in again to continue.'})

# Example protected route
@app.route('/api/me', methods=['GET'])
@login_required # This decorator handles auth and fetching the user
def get_me():
    """
    Returns the id, username, and email for the currently authenticated user.
    """
    try:
        # The user dictionary is available on request.user
        user = request.user 

        # Return just the id, username, and email using .get()
        return jsonify({
            'id': user.get('id'),
            'username': user.get('username'),
            'email': user.get('email')
        }), 200

    except Exception as e:
        print("Flask/Python Error in /api/me:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

# --- GAME SEARCH & FILTER ---
@app.route('/api/games/search', methods=['GET'])
def search_games():
    q = request.args.get('q', '')
    games = Game.query.filter(Game.title.ilike(f'%{q}%')).all()
    return jsonify([{'id': g.id, 'title': g.title, 'description': g.description} for g in games])

@app.route('/api/games/category/<int:category_id>', methods=['GET'])
def games_by_category(category_id):
    category = Category.query.get_or_404(category_id)
    return jsonify([{'id': g.id, 'title': g.title} for g in category.games])

# --- REVIEWS BY GAME/USER ---
@app.route('/api/games/<int:game_id>/reviews', methods=['GET'])
def reviews_by_game(game_id):
    reviews = Review.query.filter_by(game_id=game_id).all()
    return jsonify([{'id': r.id, 'user_id': r.user_id, 'rating': r.rating, 'comment': r.comment} for r in reviews])

@app.route('/api/users/<int:user_id>/reviews', methods=['GET'])
def reviews_by_user(user_id):
    reviews = Review.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': r.id, 'game_id': r.game_id, 'rating': r.rating, 'comment': r.comment} for r in reviews])

# --- USER LIBRARY BY USER ---
@app.route('/api/users/<int:user_id>/library', methods=['GET'])
def user_library(user_id):
    entries = UserLibrary.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': e.id, 'game_id': e.game_id, 'playtime': e.playtime} for e in entries])

# --- FRIENDS (LIST, ADD, REMOVE, REQUESTS) ---
@app.route('/api/users/<int:user_id>/friends', methods=['GET'])
def list_friends(user_id):
    friends = Friend.query.filter_by(user_id=user_id, status='accepted').all()
    return jsonify([{'id': f.id, 'friend_id': f.friend_id} for f in friends])

@app.route('/api/users/<int:user_id>/friend_requests', methods=['GET'])
def friend_requests(user_id):
    requests = Friend.query.filter_by(friend_id=user_id, status='pending').all()
    return jsonify([{'id': r.id, 'user_id': r.user_id} for r in requests])

@app.route('/api/users/<int:user_id>/friends', methods=['POST'])
def add_friend(user_id):
    data = request.json
    friend = Friend(user_id=user_id, friend_id=data['friend_id'], status='pending')
    db.session.add(friend)
    db.session.commit()
    return jsonify({'id': friend.id}), 201

@app.route('/api/friends/<int:friend_id>', methods=['DELETE'])
def remove_friend(friend_id):
    friend = Friend.query.get_or_404(friend_id)
    db.session.delete(friend)
    db.session.commit()
    return jsonify({'result': 'deleted'})

# --- WISHLIST BY USER ---
@app.route('/api/users/<int:user_id>/wishlist', methods=['GET'])
def user_wishlist(user_id):
    wishes = Wishlist.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': w.id, 'game_id': w.game_id} for w in wishes])

# --- ACHIEVEMENTS BY GAME/USER ---
@app.route('/api/games/<int:game_id>/achievements', methods=['GET'])
def achievements_by_game(game_id):
    game_achievements = GameAchievement.query.filter_by(game_id=game_id).all()
    return jsonify([{'id': ga.id, 'achievement_id': ga.achievement_id} for ga in game_achievements])

@app.route('/api/users/<int:user_id>/achievements', methods=['GET'])
def achievements_by_user(user_id):
    user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': ua.id, 'achievement_id': ua.achievement_id, 'date_unlocked': ua.date_unlocked} for ua in user_achievements])

# --- INVENTORY BY USER ---
@app.route('/api/users/<int:user_id>/inventory', methods=['GET'])
def inventory_by_user(user_id):
    items = Inventory.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': i.id, 'game_id': i.game_id, 'item_type': i.item_type, 'item_name': i.item_name, 'trade_status': i.trade_status} for i in items])

# --- PURCHASES BY USER/GAME ---
@app.route('/api/users/<int:user_id>/purchases', methods=['GET'])
def purchases_by_user(user_id):
    purchases = Purchase.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': p.id, 'game_id': p.game_id, 'price': p.price} for p in purchases])

@app.route('/api/games/<int:game_id>/purchases', methods=['GET'])
def purchases_by_game(game_id):
    purchases = Purchase.query.filter_by(game_id=game_id).all()
    return jsonify([{'id': p.id, 'user_id': p.user_id, 'price': p.price} for p in purchases])

# --- SUPPORT TICKETS BY USER ---
@app.route('/api/users/<int:user_id>/supporttickets', methods=['GET'])
def supporttickets_by_user(user_id):
    tickets = SupportTicket.query.filter_by(user_id=user_id).all()
    return jsonify([{'id': t.id, 'issue_type': t.issue_type, 'status': t.status, 'message': t.message} for t in tickets])

# --- USER PROFILE (VIEW, UPDATE) ---
@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({'id': user.id, 'username': user.username, 'email': user.email})

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    db.session.commit()
    return jsonify({'id': user.id, 'username': user.username, 'email': user.email})

@app.route('/api/users/<int:user_id>', methods=['PATCH'])
@login_required
def patch_user(user_id):
    if request.user_id != user_id:
        return jsonify({'error': 'Forbidden: You can only edit your own account.'}), 403
    user = User.query.get_or_404(user_id)
    data = request.json
    # Password change logic
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    if old_password and new_password:
        if not check_password_hash(user.password_hash, old_password):
            return jsonify({'error': 'Old password is incorrect.'}), 400
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters.'}), 400
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({'message': 'Password changed successfully.'})
    # Only allow editing username and email
    username = data.get('username')
    email = data.get('email')
    if username:
        if User.query.filter(User.username == username, User.id != user_id).first():
            return jsonify({'error': 'Username already exists.'}), 400
        user.username = username
    if email:
        if User.query.filter(User.email == email, User.id != user_id).first():
            return jsonify({'error': 'Email already exists.'}), 400
        user.email = email
    db.session.commit()
    return jsonify({'id': user.id, 'username': user.username, 'email': user.email})

# --- PASSWORD RESET (STUB) ---

@app.route('/api/password_reset/request', methods=['POST'])
def password_reset_request():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    user = User.query.filter_by(email=email).first()
    if user:
        otp = str(random.randint(100000, 999999))
        expiry = datetime.utcnow() + timedelta(minutes=10)
        user.otp_code = otp
        user.otp_expiry = expiry
        db.session.commit()
        # Send OTP email
        msg = Message('Your Password Reset OTP', recipients=[user.email])
        msg.html = f'''
        <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                <h2 style="color:#1ba9ff;margin-bottom:18px;">Password Reset</h2>
                <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {user.username},</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
                <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
            </div>
        </div>
        '''
        mail.send(msg)
    # Always return success for security
    return jsonify({'message': 'If the email exists, an OTP code has been sent.'}), 200

# --- PASSWORD RESET CONFIRM ---
@app.route('/api/password_reset/confirm', methods=['POST'])
def password_reset_confirm():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    new_password = data.get('new_password')
    if not email or not otp or not new_password:
        return jsonify({'error': 'Email, OTP, and new password are required.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not user.otp_code or not user.otp_expiry:
        return jsonify({'error': 'Invalid or expired OTP.'}), 400
    # Check OTP and expiry
    if user.otp_code != otp:
        return jsonify({'error': 'Invalid OTP.'}), 400
    if datetime.utcnow() > user.otp_expiry:
        return jsonify({'error': 'OTP has expired.'}), 400
    # Update password
    user.password_hash = generate_password_hash(new_password)
    user.otp_code = None
    user.otp_expiry = None
    db.session.commit()
    return jsonify({'message': 'Password has been reset successfully.'}), 200

# --- GAME DOWNLOAD LINK (STUB) ---
@app.route('/api/games/<int:game_id>/download', methods=['GET'])
@login_required
def download_game(game_id):
    try:
        # Only allow download if user owns the game
        entry = UserLibrary.query.filter_by(user_id=request.user_id, game_id=game_id).first()
        if not entry:
            return jsonify({'error': 'You do not own this game.'}), 403
        game = Game.query.get_or_404(game_id)
        return jsonify({'download_url': game.download_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- NEWS/EVENTS/ANNOUNCEMENTS (STUB) ---
@app.route('/api/news', methods=['GET'])
def get_news():
    # In production, fetch from News table
    return jsonify([{'id': 1, 'title': 'Welcome!', 'content': 'Platform launched.'}])

# --- GAME RECOMMENDATIONS (STUB) ---
@app.route('/api/users/<int:user_id>/recommendations', methods=['GET'])
def recommendations(user_id):
    # In production, use recommendation engine
    return jsonify([{'game_id': 1, 'reason': 'Popular'}])

# --- SEARCH USERS ---
@app.route('/api/users/search', methods=['GET'])
def search_users():
    q = request.args.get('q', '')
    users = User.query.filter(User.username.ilike(f'%{q}%')).all()
    return jsonify([{'id': u.id, 'username': u.username} for u in users])

# --- CREATE OFFER ON GAME ---
@app.route('/api/games/<int:game_id>/offer', methods=['POST'])
@login_required
@role_required('admin')
def create_offer(game_id):
    from models import Offer, Wishlist, User
    data = request.json
    discount_percent = data.get('discount_percent')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    message = data.get('message', f"Special offer on game {game_id}!")
    if not discount_percent or not start_date or not end_date:
        return jsonify({'error': 'Missing offer details.'}), 400
    offer = Offer(
        game_id=game_id,
        discount_percent=discount_percent,
        start_date=datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%S'),
        end_date=datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%S'),
        message=message
    )
    db.session.add(offer)
    db.session.commit()
    # Notify users with this game in their wishlist
    wishlists = Wishlist.query.filter_by(game_id=game_id).all()
    notified_users = []
    for wish in wishlists:
        user = User.query.get(wish.user_id)
        if user:
            # In production, send email or notification
            print(f"Notify {user.email}: {message}")
            notified_users.append(user.email)
    return jsonify({'offer_id': offer.id, 'notified_users': notified_users}), 201

# --- DEBUG: Get OTP for a user (for local testing only) ---
@app.route('/api/debug/get_otp', methods=['GET'])
def debug_get_otp():
    email = request.args.get('email')
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    return jsonify({'otp_code': user.otp_code, 'otp_expiry': str(user.otp_expiry)})

@app.route('/api/users/<int:user_id>/promote', methods=['POST'])
def promote_user(user_id):
    try:
        data = request.json
        new_role = data.get('role')
        if new_role not in ['admin', 'company', 'user']:
            return jsonify({'error': 'Invalid role.'}), 400
        user = User.query.get_or_404(user_id)
        user.role = new_role
        db.session.commit()
        return jsonify({'message': f'User promoted to {new_role}.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/avatar', methods=['POST'])
@login_required
def upload_avatar(user_id):
    try:
        if 'avatar' not in request.files:
            return jsonify({'error': 'No avatar file provided.'}), 400
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'error': 'No selected file.'}), 400
        if allowed_file(file.filename):
            upload_result = cloudinary.uploader.upload(file, public_id=f"avatar_{user_id}_{file.filename}")
            image_url = upload_result["secure_url"]
            user = User.query.get_or_404(user_id)
            user.avatar_url = image_url
            db.session.commit()
            return jsonify({'avatar_url': image_url})
        return jsonify({'error': 'Invalid file type.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/games/<int:game_id>/report', methods=['POST'])
@login_required
def report_game(game_id):
    try:
        data = request.json
        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'Reason is required.'}), 400
        # Save report (simple implementation)
        from models import UserHistory
        history = UserHistory(user_id=request.user_id, action='report_game', details=f'Reported game {game_id}: {reason}')
        db.session.add(history)
        db.session.commit()
        return jsonify({'message': 'Report submitted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/activity', methods=['GET'])
@login_required
def get_activity():
    try:
        from models import UserHistory
        logs = UserHistory.query.filter_by(user_id=request.user_id).order_by(UserHistory.timestamp.desc()).all()
        return jsonify([
            {'action': log.action, 'details': log.details, 'timestamp': log.timestamp.isoformat()} for log in logs
        ])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/docs', methods=['GET'])
def api_docs():
    try:
        docs = {
            'endpoints': [
                {'path': '/api/register', 'method': 'POST', 'desc': 'Register new user'},
                {'path': '/api/login', 'method': 'POST', 'desc': 'Login'},
                {'path': '/api/games', 'method': 'POST', 'desc': 'Add game (company only)'},
                {'path': '/api/games/<game_id>/download', 'method': 'GET', 'desc': 'Download game (ownership required)'},
                {'path': '/api/users/<user_id>/avatar', 'method': 'POST', 'desc': 'Upload user avatar'},
                {'path': '/api/games/<game_id>/report', 'method': 'POST', 'desc': 'Report a game'},
                {'path': '/api/activity', 'method': 'GET', 'desc': 'Get user activity log'},
                {'path': '/api/users/<user_id>/promote', 'method': 'POST', 'desc': 'Promote user to admin/company'},
                # ...add more as needed
            ]
        }
        return jsonify(docs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    try:
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/deactivate', methods=['POST'])
@login_required
def deactivate_user(user_id):
    try:
        user = User.query.get_or_404(user_id)
        user.is_active = False
        db.session.commit()
        return jsonify({'message': 'User deactivated.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/change_email', methods=['POST'])
@login_required
def change_email(user_id):
    try:
        data = request.json
        new_email = data.get('new_email')
        if not new_email:
            return jsonify({'error': 'New email is required.'}), 400
        if User.query.filter_by(email=new_email).first():
            return jsonify({'error': 'Email already in use.'}), 400
        user = User.query.get_or_404(user_id)
        # Send verification OTP to new email
        otp = str(random.randint(100000, 999999))
        expiry = datetime.utcnow() + timedelta(minutes=10)
        user.otp_code = otp
        user.otp_expiry = expiry
        db.session.commit()
        msg = Message('Verify your new email', recipients=[new_email])
        msg.html = f'''
        <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                <h2 style="color:#1ba9ff;margin-bottom:18px;">Verify Your New Email</h2>
                <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello,</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
                <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
            </div>
        </div>
        '''
        mail.send(msg)
        user.pending_email = new_email
        db.session.commit()
        return jsonify({'message': 'Verification OTP sent to new email.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/confirm_email_change', methods=['POST'])
@login_required
def confirm_email_change(user_id):
    try:
        data = request.json
        otp = data.get('otp')
        user = User.query.get_or_404(user_id)
        if not user.pending_email or not user.otp_code or not user.otp_expiry:
            return jsonify({'error': 'No pending email change.'}), 400
        if user.otp_code != otp:
            return jsonify({'error': 'Invalid OTP.'}), 400
        if datetime.utcnow() > user.otp_expiry:
            return jsonify({'error': 'OTP has expired.'}), 400
        user.email = user.pending_email
        user.pending_email = None
        user.otp_code = None
        user.otp_expiry = None
        db.session.commit()
        return jsonify({'message': 'Email changed successfully.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/change_password', methods=['POST'])
@login_required
def change_password(user_id):
    try:
        data = request.json
        new_password = data.get('new_password')
        if not new_password:
            return jsonify({'error': 'New password is required.'}), 400
        user = User.query.get_or_404(user_id)
        # Send OTP to user's email
        otp = str(random.randint(100000, 999999))
        expiry = datetime.utcnow() + timedelta(minutes=10)
        user.otp_code = otp
        user.otp_expiry = expiry
        db.session.commit()
        msg = Message('Password Change OTP', recipients=[user.email])
        msg.html = f'''
        <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                <h2 style="color:#1ba9ff;margin-bottom:18px;">Password Change</h2>
                <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {user.username},</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
                <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
            </div>
        </div>
        '''
        mail.send(msg)
        user.pending_password = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({'message': 'OTP sent to email.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/confirm_password_change', methods=['POST'])
@login_required
def confirm_password_change(user_id):
    try:
        data = request.json
        otp = data.get('otp')
        user = User.query.get_or_404(user_id)
        if not user.pending_password or not user.otp_code or not user.otp_expiry:
            return jsonify({'error': 'No pending password change.'}), 400
        if user.otp_code != otp:
            return jsonify({'error': 'Invalid OTP.'}), 400
        if datetime.utcnow() > user.otp_expiry:
            return jsonify({'error': 'OTP has expired.'}), 400
        user.password_hash = user.pending_password
        user.pending_password = None
        user.otp_code = None
        user.otp_expiry = None
        db.session.commit()
        return jsonify({'message': 'Password changed successfully.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/games/<int:game_id>', methods=['PUT'])

def update_game(game_id):
    try:
        data = request.json
        game = Game.query.get_or_404(game_id)
        changed_fields = []
        for field in ['title', 'description', 'developer', 'publisher', 'release_date', 'image_url', 'download_url', 'status', 'price', 'genre', 'approved']:
            if field in data and getattr(game, field) != data[field]:
                setattr(game, field, data[field])
                changed_fields.append(field)
        db.session.commit()
        # Notify users with this game in their wishlist
        if changed_fields:
            import sys
            from models import Wishlist, User
            wishes = Wishlist.query.filter_by(game_id=game_id).all()
            notified_emails = []
            failed_emails = []
            print(f"[DEBUG] Game update: {game.title} (ID: {game.id}) changed fields: {changed_fields}", file=sys.stderr)
            print(f"[DEBUG] Notifying {len(wishes)} users with this game in their wishlist...", file=sys.stderr)
            for wish in wishes:
                user = User.query.get(wish.user_id)
                if user and user.email:
                    try:
                        print(f"[DEBUG] Preparing email for user {user.email}", file=sys.stderr)
                        msg = Message(f'Update: {game.title} has changed!', recipients=[user.email])
                        msg.html = f'''
                        <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                            <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                                <h2 style="color:#1ba9ff;margin-bottom:18px;">Game Update Notification</h2>
                                <img src="{game.image_url or 'https://via.placeholder.com/120x160?text=No+Image'}" alt="{game.title}" style="width:120px;height:160px;object-fit:cover;border-radius:8px;margin-bottom:18px;"/>
                                <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">{game.title}</div>
                                <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">A game in your wishlist has been updated:</div>
                                <ul style="text-align:left;color:#fff;font-size:1.05rem;margin:0 0 18px 0;padding:0 0 0 18px;">
                                    {''.join(f'<li><b>{field.replace('_',' ').title()}</b> changed</li>' for field in changed_fields)}
                                </ul>
                                <a href="http://localhost:5000/game.html?id={game.id}" style="display:inline-block;margin-top:12px;padding:12px 32px;background:linear-gradient(90deg,#1ba9ff 0,#3b7cff 100%);color:#fff;border-radius:8px;font-size:1.1rem;font-weight:600;text-decoration:none;">View Game</a>
                            </div>
                        </div>
                        '''
                        mail.send(msg)
                        print(f"[DEBUG] Email sent to {user.email}", file=sys.stderr)
                        notified_emails.append(user.email)
                    except Exception as e:
                        print(f"[ERROR] Failed to send email to {user.email}: {e}", file=sys.stderr)
                        failed_emails.append(user.email)
            print(f"[DEBUG] Notification summary: {len(notified_emails)} succeeded, {len(failed_emails)} failed.", file=sys.stderr)
        return jsonify({'message': 'Game updated.'})
    except Exception as e:
        import sys
        print(f"[ERROR] Exception in update_game: {e}", file=sys.stderr)
        return jsonify({'error': str(e)}), 500

@app.route('/api/games/<int:game_id>/status', methods=['POST'])

def change_game_status(game_id):
    data = request.json
    status = data.get('status')
    if status not in ['draft', 'under_review', 'published', 'suspended']:
        return jsonify({'error': 'Invalid status.'}), 400
    game = Game.query.get_or_404(game_id)
    game.status = status
    db.session.commit()
    return jsonify({'id': game.id, 'status': game.status})




@app.route('/api/games/transfer', methods=['POST'])
@login_required
def transfer_game():
    try:
        data = request.json
        from_user_id = request.user_id
        to_user_id = data.get('to_user_id')
        game_id = data.get('game_id')
        if not to_user_id or not game_id:
            return jsonify({'error': 'to_user_id and game_id are required.'}), 400
        # Check ownership
        entry = UserLibrary.query.filter_by(user_id=from_user_id, game_id=game_id).first()
        if not entry:
            return jsonify({'error': 'You do not own this game.'}), 403
        # Remove from sender
        db.session.delete(entry)
        # Add to recipient
        new_entry = UserLibrary(user_id=to_user_id, game_id=game_id)
        db.session.add(new_entry)
        db.session.commit()
        return jsonify({'message': 'Game ownership transferred.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages', methods=['POST'])
@login_required
def send_message():
    try:
        data = request.json
        to_user_id = data.get('to_user_id')
        content = data.get('content')
        if not to_user_id or not content:
            return jsonify({'error': 'to_user_id and content are required.'}), 400
        # Save message as a UserHistory action (for demo; ideally use a Message model)
        details = f'To {to_user_id}: {content}'
        insert_data = {
            'user_id': request.user_id,
            'action': 'send_message',
            'details': details,
            'timestamp': datetime.utcnow().isoformat()
        }
        response = supabase.table('userhistory').insert(insert_data).execute()
        if response.get('status_code', 200) >= 400:
            return jsonify({'error': 'Failed to send message.'}), 500
        return jsonify({'message': 'Message sent.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/<int:user_id>', methods=['GET'])
@login_required
def get_messages(user_id):
    try:
        # Fetch messages sent to or from user
        from_id = request.user_id
        to_id = user_id
        # Messages sent from current user to user_id
        sent = supabase.table('userhistory').select('*').eq('user_id', from_id).eq('action', 'send_message').like('details', f'To {to_id}:%').execute()
        # Messages sent from user_id to current user
        received = supabase.table('userhistory').select('*').eq('user_id', to_id).eq('action', 'send_message').like('details', f'To {from_id}:%').execute()
        logs = []
        for row in sent.get('data', []):
            logs.append({'from': from_id, 'details': row['details'], 'timestamp': row.get('timestamp')})
        for row in received.get('data', []):
            logs.append({'from': to_id, 'details': row['details'], 'timestamp': row.get('timestamp')})
        # Sort by timestamp descending if available
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reviews/<int:review_id>/report', methods=['POST'])
@login_required
def report_review(review_id):
    try:
        data = request.json
        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'Reason is required.'}), 400
        details = f'Reported review {review_id}: {reason}'
        insert_data = {
            'user_id': request.user_id,
            'action': 'report_review',
            'details': details,
            'timestamp': datetime.utcnow().isoformat()
        }
        response = supabase.table('userhistory').insert(insert_data).execute()
        if response.get('status_code', 200) >= 400:
            return jsonify({'error': 'Failed to submit review report.'}), 500
        return jsonify({'message': 'Review report submitted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/review_reports', methods=['GET'])
@login_required
@role_required('admin')
def get_review_reports():
    try:
        response = supabase.table('userhistory').select('*').eq('action', 'report_review').order('timestamp', desc=True).execute()
        reports = response.get('data', [])
        return jsonify([
            {'user_id': r['user_id'], 'details': r['details'], 'timestamp': r.get('timestamp')} for r in reports
        ])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

### Swagger/OpenAPI setup
SWAGGER_URL = '/api/docs/swagger'  # URL for exposing Swagger UI (without trailing slash)
API_URL = '/static/swagger.json'   # Our API spec (to be created)

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "Steam Clone API"
    }
)
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

@app.route('/api/resend_otp', methods=['POST'])
def resend_otp():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    # Generate and send new OTP
    otp = str(random.randint(100000, 999999))
    expiry = datetime.utcnow() + timedelta(minutes=10)
    user.otp_code = otp
    user.otp_expiry = expiry
    db.session.commit()
    msg = Message('Your Email Verification OTP', recipients=[user.email])
    msg.html = f'''
    <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
            <h2 style="color:#1ba9ff;margin-bottom:18px;">Email Verification</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {user.username},</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
            <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
        </div>
    </div>
    '''
    mail.send(msg)
    return jsonify({'message': 'OTP resent.'})

from flask import Flask, jsonify, request
from supabase import create_client, Client
import traceback

# --- (Assuming app and supabase client are defined) ---

@app.route('/api/genres', methods=['GET'])
def get_genres():
    """
    Fetches a list of unique game genres from the 'game' table.
    """
    try:
        # Corrected Supabase query using not_.is_("column", None)
        # This should translate to "WHERE column IS NOT NULL"
        response = supabase.table('game').select('genre').not_.is_('genre', None).execute()

        # --- Debugging: Print what Supabase returns ---
        print(f"--- Supabase Response for /api/genres ---")
        print(f"Response Object Type: {type(response)}")
        if hasattr(response, 'data'):
            print(f"Data: {response.data}")
        else:
            print("Data attribute missing from response.")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-----------------------------------------")
        # --- End Debugging ---

        if getattr(response, 'error', None):
            print(f"Supabase Error fetching genres: {response.error.message}")
            # The error you got was from PostgREST, so it would appear here
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        genres = set()

        if response.data:
            for game_entry in response.data:
                genre = game_entry.get('genre')
                if genre: # This also helps filter out empty strings if any slip through
                    genres.add(genre)

        return jsonify(list(genres)), 200

    except Exception as e:
        print(f"Flask/Python Error in /api/genres:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
if __name__ == '__main__':
    with app.app_context():
        app.run(debug=True)
