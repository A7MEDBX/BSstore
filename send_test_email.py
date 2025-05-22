from app import mail, Message, app

with app.app_context():
    msg = Message('Test Thank You', recipients=['bsgamingstors@gmail.com'])
    msg.body = 'Thank you for testing the email sending feature from your Flask app!'
    mail.send(msg)
print('Test thank you email sent to your configured email.')
