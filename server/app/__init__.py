import os
import os.path

from flask import Flask
from flask.ext.login import current_user, login_user, LoginManager
from flask.ext.restless import APIManager, ProcessingException
from flask.ext.sqlalchemy import SQLAlchemy


DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        'test.sqlite')
if os.path.exists(DATABASE):
    os.unlink(DATABASE)

app = Flask(__name__)
app.config['DEBUG'] = True
app.config['TESTING'] = True
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///%s' % DATABASE

# initialize extensions.
db = SQLAlchemy(app)
api_manager = APIManager(app, flask_sqlalchemy_db=db)
login_manager = LoginManager()
login_manager.setup_app(app)

from app import views, models
from models import User


# create the API for User with the authentication guard.
def auth_func(**kw):
    if not current_user.is_authenticated():
        raise ProcessingException(description='Not Authorized', code=401)


api_manager.create_api(User, preprocessors=dict(GET_SINGLE=[auth_func],
                                                GET_MANY=[auth_func]),
                        methods=['GET','POST', 'DELETE'])

db.create_all()
user1 = User(username=u'example', password=u'example')
db.session.add(user1)
db.session.commit()

# http://localhost:5000/api/user to see users