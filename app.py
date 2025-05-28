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
         "https://bsstore.netlify.app","https://bsstore.netlify.app/"  # Added Netlify frontend for CORS
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
            # Get the user dictionary that @login_required should have already fetched
            # and attached to the request object.
            user = getattr(request, 'user', None) 

            if not user:
                # This should ideally not happen if @login_required ran successfully
                print("Error in role_required: request.user not set by @login_required.")
                return jsonify({'error': 'Authentication error, user not found on request.'}), 500 # Or 401

            user_role = user.get('role')
            print(f"--- Role Check ---")
            print(f"User role: {user_role}")
            print(f"Required roles: {roles}")

            if not user_role or user_role not in roles:
                print(f"FAIL: Role '{user_role}' not in required roles {roles}.")
                return jsonify({'error': 'Forbidden: Insufficient role privileges.'}), 403
            
            print(f"SUCCESS: Role '{user_role}' is sufficient.")
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
from flask import Flask, request, jsonify # Make sure these are imported
from datetime import datetime # For parsing release_date
import traceback # For error logging
# ... (your other imports and Supabase client setup)

@app.route('/api/games', methods=['POST'])
@login_required
@role_required('admin', 'company') # Or just 'admin' if that's what you need
def create_game():
    """
    Creates a new game in the 'game' table in Supabase.
    Assumes 'id' column in 'game' table is an IDENTITY column (auto-generates).
    """
    try:
        # Assuming you are sending JSON data for creating a game
        data = request.json 
        print(f"--- Received data for POST /api/games: {data} ---") # Log received data

        release_date_str = data.get('release_date')
        release_date_iso = None
        if release_date_str:
            try:
                # Assuming release_date is sent as 'YYYY-MM-DD'
                release_date_iso = datetime.strptime(release_date_str, '%Y-%m-%d').date().isoformat()
            except ValueError:
                return jsonify({'error': 'Invalid release_date format. Use YYYY-MM-DD.'}), 400

        # Prepare game data for insertion
        # We don't include 'id' because it should be auto-generated by Supabase
        game_data = {
            'title': data.get('title'),
            'description': data.get('description'),
            'developer': data.get('developer'),
            'publisher': data.get('publisher'),
            'release_date': release_date_iso, # Use the formatted date
            'image_url': data.get('image_url'),
            'download_url': data.get('download_url'),
            'approved': data.get('approved', False),  # Default to False if not provided
            'status': data.get('status', 'draft'),    # Default to 'draft'
            'price': data.get('price'),
            'genre': data.get('genre')
            # 'uploaded_by': request.user_id # If you have such a column to track who uploaded
        }

        # Validate required fields (example: title)
        if not game_data.get('title'):
            return jsonify({'error': 'Title is required.'}), 400
        if game_data.get('price') is not None:
            try:
                game_data['price'] = float(game_data['price'])
            except ValueError:
                return jsonify({'error': 'Price must be a valid number.'}), 400


        # Insert into the 'game' table (singular)
        insert_response = supabase.table('game').insert(game_data).execute()

        print(f"--- Supabase INSERT Response for /api/games ---")
        print(f"Data: {insert_response.data}")
        print(f"Error: {getattr(insert_response, 'error', 'N/A')}")
        print("---------------------------------------------")

        # Check for Supabase errors
        if getattr(insert_response, 'error', None):
            print(f"Supabase Error creating game: {insert_response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': insert_response.error.message}), 500
        
        if not insert_response.data:
            # This might happen if 'id' is not an identity column and wasn't provided,
            # or if there's a silent failure.
            return jsonify({'error': 'Failed to create game, no data returned (check if ID is auto-generated in Supabase for game table).'}), 500

        return jsonify(insert_response.data[0]), 201 # Return the created game data

    except Exception as e:
        print(f"Flask/Python Error in create_game (POST /api/games):")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

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
from flask import Flask, request, jsonify # Ensure jsonify and request are imported
import traceback # For error logging
# ... (your other imports and Supabase client setup)

@app.route('/api/games/<int:game_id>', methods=['DELETE'])
@login_required
@role_required('admin') # Make sure your role_required is the Supabase version
def delete_game(game_id):
    """
    Deletes a game by its ID from the 'game' table in Supabase.
    """
    try:
        print(f"--- Attempting to delete game with ID: {game_id} by User ID: {request.user_id if hasattr(request, 'user_id') else 'Unknown'} ---")

        # Perform the delete operation on the 'game' table
        # Use returning='representation' to see what was deleted (optional but good for confirmation)
        # You could also use .match({'id': game_id})
        delete_response = supabase.table('game').delete(returning='representation').eq('id', game_id).execute()

        print(f"--- Supabase DELETE Response for game {game_id} ---")
        print(f"Data: {delete_response.data}")
        print(f"Error: {getattr(delete_response, 'error', 'N/A')}")
        print("---------------------------------------------")

        # Check for Supabase errors
        if getattr(delete_response, 'error', None):
            print(f"Supabase Error deleting game {game_id}: {delete_response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': delete_response.error.message}), 500

        # Check if any data was returned (meaning a row was actually deleted)
        if not delete_response.data:
            return jsonify({'error': 'Game not found or already deleted.'}), 404
        
        # Optionally: Delete associated images from Cloudinary or other related data here if needed

        return jsonify({'result': 'Game deleted successfully.'}), 200

    except Exception as e:
        print(f"Flask/Python Error in delete_game for game_id {game_id}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
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

@app.route('/api/wishlist', methods=['GET'])
@login_required
def get_wishlist():
    """
    Fetches the wishlist for the authenticated user, including game details.
    Assumes a foreign key relationship from 'wishlist.game_id' to 'game.id'.
    """
    try:
        user_id = request.user_id

        # Fetch wishlist entries and join with the 'game' table.
        # The 'game(*)' part tells Supabase to fetch all columns from the related 'game' table.
        response = supabase.table('wishlist').select('id, date_added, game_id, game(*)').eq('user_id', user_id).execute()

        print(f"--- Supabase Response for GET /api/wishlist (User ID: {user_id}) ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-----------------------------------------------------------------")

        if getattr(response, 'error', None):
            print(f"Supabase Error fetching wishlist: {response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        wishlist_games = []
        if response.data:
            for item in response.data:
                game_details = item.get('game') # This is the joined game data
                if game_details:
                    wishlist_games.append({
                        'wishlist_item_id': item.get('id'), # ID of the wishlist entry itself
                        'date_added': item.get('date_added'),
                        'game': { # Nest game details
                            'id': game_details.get('id'),
                            'title': game_details.get('title'),
                            'description': game_details.get('description'),
                            'developer': game_details.get('developer'),
                            'publisher': game_details.get('publisher'),
                            'release_date': game_details.get('release_date'),
                            'image_url': game_details.get('image_url'),
                            'price': game_details.get('price'),
                            'genre': game_details.get('genre')
                            # 'pegi' and 'pegi_desc' omitted as not in 'game' schema
                        }
                    })
        
        return jsonify(wishlist_games), 200

    except Exception as e:
        print(f"Flask/Python Error in GET /api/wishlist for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

@app.route('/api/wishlist', methods=['POST'])
@login_required
def create_wishlist_item(): # Renamed for clarity from create_wishlist
    """
    Adds a game to the authenticated user's wishlist.
    Assumes 'id' in 'wishlist' table is auto-generated by Supabase.
    """
    try:
        data = request.json
        user_id = request.user_id
        game_id = data.get('game_id')

        if not game_id:
            return jsonify({'error': 'game_id is required'}), 400

        # --- Prevent duplicate: check if already in wishlist ---
        check_response = supabase.table('wishlist').select('id', count='exact').eq('user_id', user_id).eq('game_id', game_id).execute()

        if getattr(check_response, 'error', None):
            print(f"Supabase Error checking wishlist: {check_response.error.message}")
            return jsonify({'error': 'Database error checking wishlist', 'details': check_response.error.message}), 500
        
        if check_response.count > 0:
            return jsonify({'error': 'Game already in wishlist.'}), 409 # 409 Conflict

        # --- Prepare data for insertion ---
        # 'id' should be auto-generated by Supabase.
        # 'date_added' matches your schema.
        wishlist_data = {
            'user_id': user_id,
            'game_id': game_id,
            'date_added': datetime.now(timezone.utc).isoformat()
        }

        insert_response = supabase.table('wishlist').insert(wishlist_data).execute()

        if getattr(insert_response, 'error', None):
            print(f"Supabase Error adding to wishlist: {insert_response.error.message}")
            return jsonify({'error': 'Failed to add game to wishlist', 'details': insert_response.error.message}), 500
        
        if not insert_response.data:
             return jsonify({'error': 'Failed to add game to wishlist, no data returned (check ID auto-generation).'}), 500

        return jsonify({'message': 'Game added to wishlist.', 'wishlist_item': insert_response.data[0]}), 201

    except Exception as e:
        print(f"Flask/Python Error in POST /api/wishlist for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

@app.route('/api/wishlist/<int:game_id>', methods=['DELETE'])
@login_required
def remove_from_wishlist(game_id):
    """
    Removes a game from the authenticated user's wishlist.
    """
    try:
        user_id = request.user_id

        # Delete the wishlist item matching user_id and game_id.
        # Use returning='representation' to confirm deletion.
        delete_response = supabase.table('wishlist').delete(returning='representation').match({'user_id': user_id, 'game_id': game_id}).execute()
        
        print(f"--- Supabase Response for DELETE /api/wishlist/{game_id} (User ID: {user_id}) ---")
        print(f"Data: {delete_response.data}")
        print(f"Error: {getattr(delete_response, 'error', 'N/A')}")
        print("---------------------------------------------------------------------------")

        if getattr(delete_response, 'error', None):
            print(f"Supabase Error removing from wishlist: {delete_response.error.message}")
            return jsonify({'error': 'Failed to remove game from wishlist', 'details': delete_response.error.message}), 500

        if not delete_response.data: # No data means no row matched the criteria
             return jsonify({'error': 'Game not found in wishlist.'}), 404
        
        return jsonify({'message': 'Game removed from wishlist.'}), 200

    except Exception as e:
        print(f"Flask/Python Error in DELETE /api/wishlist/{game_id} for user {request.user_id if hasattr(request, 'user_id') else 'Unknown'}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
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
    """
    Registers a new user, stores them in Supabase 'user' table with an OTP for verification,
    and sends the OTP via email.
    Assumes 'id' in 'user' table is an auto-generated IDENTITY column.
    """
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        # --- Input Validation ---
        if not all([username, email, password]):
            return jsonify({'error': 'Username, email, and password are required.'}), 400
        if len(password) < 8: # Basic password strength
            return jsonify({'error': 'Password must be at least 8 characters long.'}), 400
        # Add more validation for email format, username characters if needed

        # --- Check if username or email already exists ---
        # Using count='exact' for efficiency if you only need to know existence
        check_user_response = supabase.table('user').select('id', count='exact').or_(f"username.eq.{username},email.eq.{email}").execute()
        
        if getattr(check_user_response, 'error', None):
            print(f"Supabase Error checking existing user: {check_user_response.error.message}")
            return jsonify({'error': 'Database error during registration.', 'details': check_user_response.error.message}), 500
        
        if check_user_response.count > 0: # Check count from the response
            return jsonify({'error': 'Username or email already exists.'}), 409 # 409 Conflict is more appropriate

        # --- Prepare user data ---
        hashed_password = generate_password_hash(password)
        otp = str(random.randint(100000, 999999))
        otp_expiry_time = datetime.now(timezone.utc) + timedelta(minutes=10) # OTP valid for 10 minutes
        otp_expiry_iso = otp_expiry_time.isoformat()

        # Your 'user' table schema from earlier:
        # "id" INTEGER NOT NULL, (Should be IDENTITY)
        # "username" VARCHAR(80) NOT NULL,
        # "email" VARCHAR(120) NOT NULL,
        # "password_hash" VARCHAR(10000) NOT NULL, (Adjusted length)
        # "is_verified" BOOLEAN,
        # "verification_token" VARCHAR(128), (Not used in this OTP flow, can be null)
        # "role" VARCHAR(20),
        # "is_active" BOOLEAN,
        # "otp_code" VARCHAR(10),
        # "otp_expiry" TIMESTAMP,
        user_data_to_insert = {
            'username': username,
            'email': email,
            'password_hash': hashed_password,
            'is_verified': False, # User is not verified until OTP is confirmed
            'otp_code': otp,
            'otp_expiry': otp_expiry_iso,
            'role': 'user',  # Default role
            'is_active': True # New users are active by default, pending verification
            # 'verification_token': None, # If you have this column and it can be null
        }

        # --- Insert new user into Supabase 'user' table ---
        insert_response = supabase.table('user').insert(user_data_to_insert).execute()

        if getattr(insert_response, 'error', None):
            print(f"Supabase Error creating user: {insert_response.error.message}")
            return jsonify({'error': 'Failed to create user account.', 'details': insert_response.error.message}), 500
        
        if not insert_response.data:
            print(f"Failed to create user '{username}', no data returned from insert. Check if 'id' is auto-generating.")
            return jsonify({'error': 'Failed to create user account (no confirmation data).'}), 500
        
        created_user = insert_response.data[0] # Get the newly created user data (includes the auto-generated ID)

        # --- Send verification email with OTP ---
        email_sent = _send_otp_email(
            email_address=created_user['email'],
            username=created_user['username'],
            otp_code=otp,
            subject='Verify Your Email Address for BS Store',
            purpose_text='Email Verification'
        )

        if not email_sent:
            # Log that email failed but user was created. User can request OTP again.
            print(f"User {created_user['username']} created, but OTP email failed to send.")
            # You might choose to return a specific message here or still the generic one.
        
        # --- Log history (optional) ---
        try:
            supabase.table('user_history').insert({
                'user_id': created_user['id'],
                'action': 'account_registered_pending_verification',
                'details': f'User {created_user["username"]} registered and OTP sent.',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }).execute() # Fire and forget
        except Exception as history_err:
            print(f"Error logging user history for {created_user['id']}: {history_err}")


        return jsonify({
            'id': created_user.get('id'), 
            'username': created_user.get('username'), 
            'message': 'Registration successful. A verification OTP has been sent to your email.'
        }), 201

    except Exception as e:
        # Catch any other unexpected Python errors.
        data_dict = data if isinstance(data, dict) else {}
        print(f"Flask/Python Error in /api/register for email {data_dict.get('email', 'Unknown')}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500


from flask import Flask, request, jsonify # Ensure these are imported
from supabase import create_client, Client # Ensure Supabase is imported
from datetime import datetime, timezone # For OTP expiry and timezone
# from werkzeug.security import generate_password_hash # Not needed for this specific function
from flask_mail import Message # For sending email, ensure 'mail' is configured
import traceback

# --- ASSUMPTIONS ---
# 1. 'app', 'supabase' (Supabase client), and 'mail' (Flask-Mail instance) are defined and configured.
# 2. Your 'user' table in Supabase has columns: 'id', 'email', 'username', 
#    'is_verified' (BOOLEAN), 'otp_code' (VARCHAR), 'otp_expiry' (TIMESTAMP or TIMESTAMPTZ).
# 3. You have a helper function _parse_otp_expiry(otp_expiry_str) as discussed.
# 4. You might have a general email sending helper like _send_otp_email that can be adapted.
# --- END ASSUMPTIONS ---

# If you don't have _parse_otp_expiry defined elsewhere:
def _parse_otp_expiry(otp_expiry_str: str):
    if not otp_expiry_str:
        return None
    try:
        parsed_dt = datetime.fromisoformat(otp_expiry_str.replace('Z', '+00:00'))
        if parsed_dt.tzinfo is None or parsed_dt.tzinfo.utcoffset(parsed_dt) is None:
            return parsed_dt.replace(tzinfo=timezone.utc)
        return parsed_dt
    except (ValueError, TypeError) as e:
        print(f"Error parsing otp_expiry_str '{otp_expiry_str}': {e}")
        return None

# If you don't have a welcome email sender, here's an adaptation:
def _send_welcome_email(email_address, username):
    """Helper function to send a welcome email."""
    subject = "Registration Complete - Welcome!"
    purpose_text = "Registration Complete"
    msg = Message(subject, recipients=[email_address])
    msg.html = f'''
    <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
            <h2 style="color:#1ba9ff;margin-bottom:18px;">{purpose_text}</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Welcome, {username or "User"}!</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your email has been successfully verified and your registration is complete.</div>
        </div>
    </div>
    '''
    try:
        mail.send(msg) # Uses the 'mail' instance from Flask-Mail
        print(f"Welcome email sent to {email_address}")
        return True
    except Exception as e:
        print(f"Failed to send welcome email to {email_address}: {e}")
        traceback.print_exc()
        return False

@app.route('/api/verify_otp', methods=['POST'])
def verify_email_otp():
    """
    Verifies an email OTP for a user and updates their status in Supabase 'user' table.
    """
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return jsonify({'error': 'Email and OTP are required.'}), 400

        # --- Fetch user from Supabase 'user' table by email ---
        user_response = supabase.table('user').select('*').eq('email', email).maybe_single().execute()

        # --- Debugging ---
        print(f"--- Supabase Response for Verify OTP (Email: {email}) ---")
        print(f"User Data: {user_response.data}")
        print(f"User Error: {getattr(user_response, 'error', 'N/A')}")
        print("--------------------------------------------------------")
        # --- End Debugging ---

        if getattr(user_response, 'error', None):
            print(f"Supabase Error finding user by email '{email}' for OTP verify: {user_response.error.message}")
            return jsonify({'error': 'Error processing your request.'}), 500 # Internal error
        
        user = user_response.data

        if not user:
            return jsonify({'error': 'User not found or invalid email.'}), 404
        
        if user.get('is_verified'):
             return jsonify({'message': 'Email already verified.'}), 200 # Or 400 if you prefer

        # Check if OTP details exist (they might have been cleared or never set)
        if not user.get('otp_code') or not user.get('otp_expiry'):
            return jsonify({'error': 'No valid OTP found for this user. Please request a new one or contact support.'}), 400

        # --- Parse OTP expiry string from DB to a datetime object ---
        otp_expiry_dt = _parse_otp_expiry(user['otp_expiry'])
        
        if not otp_expiry_dt: # Parsing failed
            print(f"Failed to parse otp_expiry '{user['otp_expiry']}' for user {user['id']}")
            return jsonify({'error': 'Error processing OTP information. Please try again.'}), 500

        # --- Validate OTP ---
        if user['otp_code'] != otp:
            return jsonify({'error': 'Invalid OTP.'}), 400
        
        # Compare current UTC time with the (now aware) expiry time
        if datetime.now(timezone.utc) > otp_expiry_dt:
            # Optionally, clear the expired OTP from the database here if you want
            # supabase.table('user').update({'otp_code': None, 'otp_expiry': None}).eq('id', user['id']).execute()
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400

        # --- OTP is valid, update user status ---
        update_data = {
            'is_verified': True,
            'otp_code': None,       # Clear OTP code
            'otp_expiry': None,     # Clear OTP expiry
            'is_active': True       # Ensure user is active
        }
        
        update_response = supabase.table('user').update(update_data).eq('id', user['id']).execute()

        if getattr(update_response, 'error', None):
            print(f"Supabase Error updating user verification for {user['id']}: {update_response.error.message}")
            return jsonify({'error': 'Failed to update email verification status.', 'details': update_response.error.message}), 500
        
        if not update_response.data:
            print(f"Warning: Failed to update verification status for user {user['id']}, no data returned from update. Check RLS.")
            # Assuming success if no error from Supabase for update, as 'returning' might be minimal.
            # If no data, you might want to fetch the user again to confirm or just return success.
            pass

        # --- Send notification email after successful verification (optional) ---
        _send_welcome_email(user['email'], user.get('username'))

        return jsonify({'message': 'Email verified successfully. Your account is now active!'}), 200

    except Exception as e:
        data_dict = data if isinstance(data, dict) else {}
        print(f"Flask/Python Error in /api/verify_otp for email {data_dict.get('email', 'Unknown')}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

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
        response = supabase.table('user').select('*').eq('username', username).maybe_single().execute()

        print(f"--- Supabase Login Response for {username} ---")
        print(f"Data: {getattr(response, 'data', None)}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("-----------------------------------------")

        # Defensive: If response is None, has no .data, or .data is None/empty, treat as invalid credentials
        if not response or not hasattr(response, 'data') or not response.data:
            return jsonify({'error'}), 401

        user = response.data

        # Check the password_hash (ensure this column exists and is populated)
        if not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
            return jsonify({'error'}), 401

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
        # For any unexpected error, return the same error as invalid credentials (do not leak details)
        return jsonify({'error': 'Invalid credentials'}), 401
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
    """
    Fetches details for a specific user by their ID from the Supabase 'user' table.
    """
    try:
        print(f"--- Attempting to fetch user with ID: {user_id} ---")

        # REMOVED 'avatar_url' from select if it doesn't exist in your table
        response = supabase.table('user').select(
            'id, username, email, role, is_verified, is_active' # Adjust fields as per your actual schema
        ).eq('id', user_id).execute()

        print(f"--- Supabase GET Response for user {user_id} ---")
        print(f"Response Object Type: {type(response)}")
        print(f"Response Attributes: {dir(response)}")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("---------------------------------------------")

        if getattr(response, 'error', None):
            print(f"Supabase Error fetching user {user_id}: {response.error.message}")
            return jsonify({'error': 'Database operation failed', 'details': response.error.message}), 500

        if not response.data:
            return jsonify({'error': 'User not found.'}), 404
        
        user_data = response.data[0]
        return jsonify(user_data), 200

    except Exception as e:
        print(f"Flask/Python Error in get_user for user_id {user_id}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500
# --- UPDATE USER (PUT - Partial Update in this case) ---
@app.route('/api/users/<int:user_id>', methods=['PUT'])
@login_required # Assuming only logged-in users can attempt to update
def update_user(user_id_from_url): # Renamed to avoid clash with local user_id variable
    """
    Updates username and/or email for a user.
    Only allows user to update their own profile.
    """
    if request.user_id != user_id_from_url:
        return jsonify({'error': 'Forbidden: You can only update your own profile.'}), 403

    try:
        data = request.json
        update_payload = {}
        current_user_data = request.user # Get current user details from @login_required

        new_username = data.get('username')
        new_email = data.get('email')

        # Username update logic
        if new_username and new_username != current_user_data.get('username'):
            # Check if new username already exists for another user
            check_username_res = supabase.table('user').select('id', count='exact').eq('username', new_username).not_.eq('id', user_id_from_url).execute()
            if getattr(check_username_res, 'error', None):
                return jsonify({'error': 'Database error checking username', 'details': check_username_res.error.message}), 500
            if check_username_res.count > 0:
                return jsonify({'error': 'Username already taken by another user.'}), 409
            update_payload['username'] = new_username

        # Email update logic
        if new_email and new_email != current_user_data.get('email'):
            # Check if new email already exists for another user
            check_email_res = supabase.table('user').select('id', count='exact').eq('email', new_email).not_.eq('id', user_id_from_url).execute()
            if getattr(check_email_res, 'error', None):
                return jsonify({'error': 'Database error checking email', 'details': check_email_res.error.message}), 500
            if check_email_res.count > 0:
                return jsonify({'error': 'Email already registered by another user.'}), 409
            update_payload['email'] = new_email
            # Consider re-verification if email changes: update_payload['is_verified'] = False 
            # and trigger OTP flow, or have a separate email change confirmation flow.

        if not update_payload:
            return jsonify({'message': 'No changes provided or new values are the same as current.', 'user': current_user_data}), 200

        # Perform update
        update_response = supabase.table('user').update(update_payload).eq('id', user_id_from_url).execute()

        if getattr(update_response, 'error', None):
            return jsonify({'error': 'Failed to update user.', 'details': update_response.error.message}), 500
        if not update_response.data:
            return jsonify({'error': 'Failed to update user (no confirmation data). Check RLS.'}), 500

        return jsonify(update_response.data[0]), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

# --- UPDATE USER (PATCH - More Comprehensive) ---
@app.route('/api/users/<int:user_id_from_url>', methods=['PATCH'])
@login_required
def patch_user(user_id_from_url):
    if request.user_id != user_id_from_url:
        return jsonify({'error': 'Forbidden: You can only edit your own account.'}), 403

    try:
        data = request.json
        current_user_data = request.user # User data from @login_required
        update_payload = {}
        response_message = "User profile updated."

        # Password change logic
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if old_password and new_password:
            if not current_user_data.get('password_hash') or not check_password_hash(current_user_data['password_hash'], old_password):
                return jsonify({'error': 'Old password is incorrect.'}), 400
            if len(new_password) < 8:
                return jsonify({'error': 'New password must be at least 8 characters.'}), 400
            
            update_payload['password_hash'] = generate_password_hash(new_password)
            response_message = "Password changed successfully."
            # If only password is changing, we can update and return early
            if len(data) == 2: # Only old_password and new_password were sent
                update_pw_res = supabase.table('user').update(update_payload).eq('id', user_id_from_url).execute()
                if getattr(update_pw_res, 'error', None) or not update_pw_res.data:
                     return jsonify({'error': 'Failed to update password.', 'details': getattr(update_pw_res, 'error', {}).get('message')}), 500
                return jsonify({'message': response_message})


        # Username/Email update logic (can be combined with password change or done separately)
        new_username = data.get('username')
        new_email = data.get('email')

        if new_username and new_username != current_user_data.get('username'):
            check_username_res = supabase.table('user').select('id', count='exact').eq('username', new_username).not_.eq('id', user_id_from_url).execute()
            if getattr(check_username_res, 'error', None):
                return jsonify({'error': 'Database error checking username', 'details': check_username_res.error.message}), 500
            if check_username_res.count > 0:
                return jsonify({'error': 'Username already taken.'}), 409
            update_payload['username'] = new_username

        if new_email and new_email != current_user_data.get('email'):
            check_email_res = supabase.table('user').select('id', count='exact').eq('email', new_email).not_.eq('id', user_id_from_url).execute()
            if getattr(check_email_res, 'error', None):
                return jsonify({'error': 'Database error checking email', 'details': check_email_res.error.message}), 500
            if check_email_res.count > 0:
                return jsonify({'error': 'Email already registered.'}), 409
            update_payload['email'] = new_email
            # If email changes, you might want to set is_verified to False and trigger OTP flow
            # update_payload['is_verified'] = False 
            # update_payload['otp_code'] = new_otp 
            # update_payload['otp_expiry'] = new_expiry
            # _send_otp_email(...) # This makes the flow more complex

        # Add other updatable fields like avatar_url
        if 'avatar_url' in data:
             update_payload['avatar_url'] = data.get('avatar_url')


        if not update_payload:
            # If password was changed and returned, this part won't be reached.
            # If only old/new password were sent but password change logic didn't proceed,
            # or if no other valid fields were sent for update.
            return jsonify({'message': 'No valid fields provided for update or values are unchanged.', 'user': current_user_data}), 200

        # Perform the update
        update_response = supabase.table('user').update(update_payload).eq('id', user_id_from_url).execute()

        if getattr(update_response, 'error', None):
            return jsonify({'error': 'Failed to update user profile.', 'details': update_response.error.message}), 500
        if not update_response.data:
            # As per Supabase, UPDATE with returning=representation (default for supabase-py) should return data.
            # If no data, it might mean the row wasn't found or RLS prevented the read-back.
            return jsonify({'error': 'Profile update failed or no changes applied (no data returned).'}), 500
        
        # If only password was changed and returned earlier, this won't be hit.
        # Otherwise, this is for username/email/other updates.
        return jsonify({'message': response_message, 'user': update_response.data[0]}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

# --- PASSWORD RESET (STUB) ---

@app.route('/api/password_reset/request', methods=['POST'])
def password_reset_request():
    """
    Handles a password reset request. Finds user by email, generates OTP,
    stores it in Supabase 'user' table, and sends it via email.
    """
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({'error': 'Email is required.'}), 400

        # --- Fetch user from Supabase 'user' table by email ---
        # Using maybe_single() as email should be unique
        user_response = supabase.table('user').select('*').eq('email', email).maybe_single().execute()

        # --- Debugging ---
        print(f"--- Supabase Response for Password Reset Request (Email: {email}) ---")
        print(f"User Data: {user_response.data}")
        print(f"User Error: {getattr(user_response, 'error', 'N/A')}")
        print("--------------------------------------------------------------------")
        # --- End Debugging ---

        if getattr(user_response, 'error', None):
            print(f"Supabase Error finding user by email '{email}': {user_response.error.message}")
            # Security: Don't reveal if email exists. Log the error and return generic success.
            return jsonify({'message': 'If an account with that email exists, a password reset OTP has been sent.'}), 200
        
        user = user_response.data # This will be the user dictionary or None

        if user:
            otp = str(random.randint(100000, 999999))
            # Ensure otp_expiry is timezone-aware (UTC is good practice)
            expiry_time = datetime.now(timezone.utc) + timedelta(minutes=10)
            expiry_iso = expiry_time.isoformat()

            # --- Update user in Supabase with OTP and expiry ---
            update_data = {'otp_code': otp, 'otp_expiry': expiry_iso}
            # Use the user's ID for the update condition
            update_response = supabase.table('user').update(update_data).eq('id', user['id']).execute()

            if getattr(update_response, 'error', None):
                print(f"Supabase Error updating OTP for user {user['id']}: {update_response.error.message}")
                # Log error, but still return generic success for security
                return jsonify({'message': 'If an account with that email exists, a password reset OTP has been sent.'}), 200
            
            if not update_response.data:
                print(f"Warning: Failed to update OTP for user {user['id']}, no data returned from update. Check RLS or if row exists.")
                # Log error, but still return generic success
                return jsonify({'message': 'If an account with that email exists, a password reset OTP has been sent.'}), 200

            # --- Send OTP email ---
            msg = Message('Your Password Reset OTP', recipients=[user['email']])
            msg.html = f'''
            <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
                    <h2 style="color:#1ba9ff;margin-bottom:18px;">Password Reset</h2>
                    <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {user.get("username", "there")},</div>
                    <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code for password reset is:</div>
                    <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
                    <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
                </div>
            </div>
            '''
            try:
                mail.send(msg)
                print(f"Password reset OTP sent to {user['email']}")
            except Exception as mail_error:
                print(f"Failed to send password reset email to {user['email']}: {mail_error}")
                traceback.print_exc()
                # Still return a generic success message for security, but log the mail error
                return jsonify({'message': 'If an account with that email exists, an OTP has been processed (email sending may have issues).'}), 200
        else:
            # User not found, but still return a generic message for security
            print(f"Password reset request for non-existent email: {email}")

        return jsonify({'message': 'If an account with that email exists, a password reset OTP has been sent.'}), 200

    except Exception as e:
        # This catches broader errors in the try block
        data_dict = data if isinstance(data, dict) else {}
        print(f"Flask/Python Error in password_reset_request for email {data_dict.get('email', 'Unknown')}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

def _parse_otp_expiry(otp_expiry_str: str):
    """
    Safely parses an ISO datetime string (possibly naive or with 'Z') 
    and returns a timezone-aware UTC datetime object.
    Returns None if parsing fails or input is None.
    """
    if not otp_expiry_str:
        return None
    try:
        # Handle 'Z' for UTC if present, otherwise fromisoformat handles standard offsets
        parsed_dt = datetime.fromisoformat(otp_expiry_str.replace('Z', '+00:00'))
        
        # If parsed_dt is still naive (meaning no 'Z' or offset was in the original string)
        # AND your database stores these naive timestamps as UTC implicitly:
        if parsed_dt.tzinfo is None or parsed_dt.tzinfo.utcoffset(parsed_dt) is None:
            return parsed_dt.replace(tzinfo=timezone.utc) # Make it UTC aware
        return parsed_dt # It was already parsed as aware (had 'Z' or an offset)
    except (ValueError, TypeError) as e:
        print(f"Error parsing otp_expiry_str '{otp_expiry_str}': {e}")
        return None

@app.route('/api/password_reset/confirm', methods=['POST'])
def password_reset_confirm():
    """
    Confirms a password reset using an OTP and sets a new password.
    Updates 'user' table in Supabase.
    """
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')
        new_password = data.get('new_password')

        if not all([email, otp, new_password]):
            return jsonify({'error': 'Email, OTP, and new password are required.'}), 400
        
        if len(new_password) < 8: # Example: Basic password length validation
            return jsonify({'error': 'New password must be at least 8 characters.'}), 400

        # --- Fetch user from Supabase 'user' table by email ---
        user_response = supabase.table('user').select('*').eq('email', email).maybe_single().execute()

        print(f"--- Supabase Response for Password Reset Confirm (Email: {email}) ---")
        print(f"User Data: {user_response.data}")
        print(f"User Error: {getattr(user_response, 'error', 'N/A')}")
        print("--------------------------------------------------------------------")

        if getattr(user_response, 'error', None):
            print(f"Supabase Error finding user by email '{email}' for confirm: {user_response.error.message}")
            return jsonify({'error': 'Error processing request or invalid details.'}), 400 
        
        user = user_response.data

        if not user or not user.get('otp_code') or not user.get('otp_expiry'):
            return jsonify({'error': 'Invalid or expired OTP. Please request a new one.'}), 400

        # --- Check OTP and expiry using the helper for robust parsing ---
        otp_expiry_dt = _parse_otp_expiry(user['otp_expiry'])
        
        if not otp_expiry_dt: # Parsing failed
            print(f"Failed to parse otp_expiry '{user['otp_expiry']}' for user {user['id']}")
            return jsonify({'error': 'Error processing OTP expiry. Please try again.'}), 500

        if user['otp_code'] != otp:
            return jsonify({'error': 'Invalid OTP.'}), 400
        
        # Now both datetime.now(timezone.utc) and otp_expiry_dt are UTC aware
        if datetime.now(timezone.utc) > otp_expiry_dt:
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400

        # --- Update password and clear OTP fields ---
        hashed_new_password = generate_password_hash(new_password)
        update_data = {
            'password_hash': hashed_new_password,
            'otp_code': None,       # Clear OTP code
            'otp_expiry': None,     # Clear OTP expiry
            'is_verified': True     # Good practice to ensure user is marked as verified
        }
        
        update_response = supabase.table('user').update(update_data).eq('id', user['id']).execute()

        if getattr(update_response, 'error', None):
            print(f"Supabase Error updating password for user {user['id']}: {update_response.error.message}")
            return jsonify({'error': 'Failed to reset password.', 'details': update_response.error.message}), 500
        
        if not update_response.data:
            print(f"Warning: Failed to update password for user {user['id']}, no data returned from update. Check RLS or if row truly updated.")
            # Depending on PostgREST preference for UPDATE (Minimal, Representation), data might be empty on success.
            # If no error, assume success here. If you need confirmation of the update, ensure 'returning=representation'.
            # For simplicity, we'll assume if no error, it's okay.
            pass

        return jsonify({'message': 'Password has been reset successfully.'}), 200

    except Exception as e:
        data_dict = data if isinstance(data, dict) else {} # Ensure data is a dict for .get()
        print(f"Flask/Python Error in password_reset_confirm for email {data_dict.get('email', 'Unknown')}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

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
        if file and allowed_file(file.filename):
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

@app.route('/api/users/<int:user_id_from_url>', methods=['DELETE'])
@login_required
def delete_user_account(user_id_from_url):
    """
    Deletes a user account.
    Only admin or the user themselves can delete the account.
    """
    try:
        print(f"--- Attempting to DELETE user with ID: {user_id_from_url} by User: {request.user_id} ---")

        # Security: Only admin or the user themselves can delete the account
        if request.user_id != user_id_from_url and request.user.get('role') != 'admin':
            return jsonify({'error': 'Forbidden: You can only delete your own account.'}), 403
        
        # Optional: For self-delete, you might want password confirmation in a real app,
        # but this is the basic delete operation.

        # Perform delete. Use returning='representation' to get info about deleted row.
        response = supabase.table('user').delete(returning='representation').eq('id', user_id_from_url).execute()

        print(f"--- Supabase DELETE Response for user {user_id_from_url} ---")
        print(f"Data: {response.data}")
        print(f"Error: {getattr(response, 'error', 'N/A')}")
        print("---------------------------------------------")

        if getattr(response, 'error', None):
            # This could be due to RLS or other database constraints (e.g., if user still owns things
            # and you don't have ON DELETE CASCADE set up for those foreign keys)
            print(f"Supabase Error deleting user {user_id_from_url}: {response.error.message}")
            return jsonify({'error': 'Failed to delete user account.', 'details': response.error.message}), 500
        
        if not response.data: 
            # This means no user with that ID was found to delete
            return jsonify({'error': 'User not found or already deleted.'}), 404

        # If user deletes their own account, add their current token to blacklist
        if request.user_id == user_id_from_url:
            token = get_token_from_header() # You need this helper defined
            if token:
                jwt_blacklist.add(token) # You need jwt_blacklist defined globally (e.g., as a set())
                print(f"Token for user {user_id_from_url} added to blacklist after account deletion.")

        return jsonify({'message': 'Account deleted successfully.'}), 200

    except Exception as e:
        print(f"Flask/Python Error in delete_user_account for user_id {user_id_from_url}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

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
@login_required
@role_required('admin', 'company') # Or just 'admin' based on your needs
def update_game(game_id):
    """
    Updates details for a specific game in the 'game' table using Supabase.
    """
    try:
        data = request.json
        current_user_id = request.user_id
        current_user_role = request.user.get('role') # Assuming @login_required sets request.user

        print(f"--- Attempting to update game ID: {game_id} by User ID: {current_user_id} ---")
        print(f"--- Received data for PUT /api/games/{game_id}: {data} ---")

        # 1. Check if the game exists and get its current data (e.g., to check 'uploaded_by')
        game_check_response = supabase.table('game').select('*').eq('id', game_id).maybe_single().execute()

        if getattr(game_check_response, 'error', None):
            print(f"Supabase Error checking game {game_id}: {game_check_response.error.message}")
            return jsonify({'error': 'Database error checking game', 'details': game_check_response.error.message}), 500
        
        if not game_check_response.data:
            return jsonify({'error': 'Game not found.'}), 404

        game_to_update = game_check_response.data

        # 2. Authorization: Check if the user is an admin or (if applicable) the company that uploaded the game
        #    This assumes you have an 'uploaded_by' column in your 'game' table storing the user_id of the uploader.
        if current_user_role != 'admin':
            if 'uploaded_by' in game_to_update and game_to_update.get('uploaded_by') != current_user_id:
                return jsonify({'error': 'Forbidden: You do not have permission to edit this game.'}), 403
            elif 'uploaded_by' not in game_to_update: # Fallback if 'uploaded_by' isn't tracked
                 return jsonify({'error': 'Forbidden: Insufficient permissions.'}), 403


        # 3. Prepare the update payload (only include fields that are actually sent in the request)
        update_payload = {}
        allowed_fields_to_update = [
            'title', 'description', 'developer', 'publisher', 
            'release_date', 'image_url', 'download_url', 
            'approved', 'status', 'price', 'genre'
        ]

        for field in allowed_fields_to_update:
            if field in data:
                if field == 'release_date' and data[field]:
                    try:
                        update_payload[field] = datetime.strptime(data[field], '%Y-%m-%d').date().isoformat()
                    except ValueError:
                        return jsonify({'error': f'Invalid release_date format for {field}. Use YYYY-MM-DD.'}), 400
                elif field == 'price' and data[field] is not None:
                    try:
                        update_payload[field] = float(data[field])
                    except ValueError:
                         return jsonify({'error': 'Price must be a valid number.'}), 400
                elif field == 'approved' and isinstance(data[field], bool):
                     update_payload[field] = data[field]
                elif field != 'release_date' and field != 'price' and field != 'approved': # Avoid reprocessing already handled fields
                    update_payload[field] = data[field]
        
        if not update_payload:
            return jsonify({'message': 'No valid fields provided for update.'}), 400

        # 4. Perform the update operation in Supabase
        update_response = supabase.table('game').update(update_payload).eq('id', game_id).execute()

        print(f"--- Supabase UPDATE Response for game {game_id} ---")
        print(f"Data: {update_response.data}")
        print(f"Error: {getattr(update_response, 'error', 'N/A')}")
        print("---------------------------------------------")

        if getattr(update_response, 'error', None):
            print(f"Supabase Error updating game {game_id}: {update_response.error.message}")
            return jsonify({'error': 'Database operation failed during update', 'details': update_response.error.message}), 500

        if not update_response.data:
             # This can happen if 'returning' preference in PostgREST is 'minimal'
             # If there's no error, we can assume the update was successful.
             # To be certain, fetch the game again or use returning='representation' in update.
            return jsonify({'message': 'Game updated successfully (no data returned by update).'}), 200


        # Notify users (this was in your original very long code, adapt as needed)
        # This requires fetching wishlists and sending emails, which can be complex.
        # For now, focusing on the core update.
        # ... (notification logic if you re-implement it) ...

        return jsonify({'message': 'Game updated successfully.', 'game': update_response.data[0]}), 200

    except Exception as e:
        print(f"Flask/Python Error in update_game for game_id {game_id}:")
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500

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
            <h2 style="color:#1ba9ff;margin-bottom:18px;">{purpose_text}</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {username or "there"},</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
            <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp}</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
        </div>
    </div>
    '''
    mail.send(msg)
    return jsonify({'message': 'OTP resent.'})
def _send_otp_email(email_address, username, otp_code, subject, purpose_text):
    """Helper function to send OTP emails."""
    # Ensure 'mail' is accessible here. If it's part of your 'app' context,
    # this function might need to be a method of a class, or 'mail' passed in,
    # but typically if 'mail = Mail(app)' is global, it's fine.
    msg = Message(subject, recipients=[email_address])
    msg.html = f'''
    <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
            <h2 style="color:#1ba9ff;margin-bottom:18px;">{purpose_text}</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Hello {username or "there"},</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">Your OTP code is:</div>
            <div style="color:#fff;font-size:2rem;font-weight:700;margin-bottom:18px;letter-spacing:2px;">{otp_code}</div>
            <div style="color:#aaa;font-size:1.05rem;margin-bottom:18px;">It expires in 10 minutes.</div>
        </div>
    </div>
    '''
    try:
        mail.send(msg) # Uses the 'mail' instance from Flask-Mail
        print(f"{purpose_text} OTP sent to {email_address}")
        return True
    except Exception as e:
        print(f"Failed to send {purpose_text} email to {email_address}: {e}")
        traceback.print_exc() # Make sure traceback is imported
        return False

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
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
