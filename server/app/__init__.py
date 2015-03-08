import os
import os.path

from flask import Flask, render_template, redirect, url_for, flash
from flask.ext.login import current_user, login_user, LoginManager, UserMixin
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