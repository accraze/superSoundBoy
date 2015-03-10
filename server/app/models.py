from flask.ext.login import current_user, login_user, LoginManager, UserMixin
from app import db

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.Unicode)
    password = db.Column(db.Unicode)