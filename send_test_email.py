from app import mail, Message, app

with app.app_context():
    msg = Message('Test Thank You', recipients=['bsgamingstors@gmail.com'])
    msg.html = '''
    <div style="background:#181a20;padding:32px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="background:#23262e;margin:0 auto;padding:32px 40px;border-radius:16px;max-width:480px;box-shadow:0 2px 16px #0005;">
            <h2 style="color:#1ba9ff;margin-bottom:18px;">Thank You for Testing!</h2>
            <div style="color:#fff;font-size:1.2rem;font-weight:600;margin-bottom:8px;">Thank you for testing the email sending feature from your Flask app!</div>
        </div>
    </div>
    '''
    mail.send(msg)
print('Test thank you email sent to your configured email.')
