import requests

url = 'http://127.0.0.1:5000/api/register'
data = {
    'username': 'bebo',
    'email': 'alsharefbebo@gmail.com',
    'password': 'TestPassword123!'
}

response = requests.post(url, json=data)
print('Status code:', response.status_code)
print('Response:', response.json())
