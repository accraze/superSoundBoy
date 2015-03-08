import os
import os.path

from flask import Flask, render_template, redirect, url_for, flash
from flask.ext.login import current_user, login_user, LoginManager, UserMixin
from flask.ext.restless import APIManager, ProcessingException
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.wtf import Form

from wtforms import PasswordField, SubmitField, TextField
from wtforms.validators import Required

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


# create the user database model.
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.Unicode)
    password = db.Column(db.Unicode)


# create the database and add a test user.
db.create_all()
user1 = User(username=u'example', password=u'example')
db.session.add(user1)
db.session.commit()


# Step 5: this is required for Flask-Login.
@login_manager.user_loader
def load_user(userid):
    return User.query.get(userid)


class LoginForm(Form):
    username = TextField('username')
    password = PasswordField('password')
    submit = SubmitField('Login')


# create endpoints for the application, one for index and one for login
@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        #
        # you would check username and password here...
        #
        username, password = form.username.data, form.password.data
        matches = User.query.filter_by(username=username,
                                       password=password).all()
        if len(matches) > 0:
            login_user(matches[0])
            return redirect(url_for('index'))
        flash('Username and password pair not found')
    return render_template('login.html', form=form)


# create the API for User with the authentication guard.
def auth_func(**kw):
    if not current_user.is_authenticated():
        raise ProcessingException(description='Not Authorized', code=401)

api_manager.create_api(User, preprocessors=dict(GET_SINGLE=[auth_func],
                                                GET_MANY=[auth_func]),
                        methods=['GET','POST', 'DELETE'])

app.run()

# visit http://localhost:5000/api/user to see users