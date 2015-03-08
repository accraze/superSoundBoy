from flask.ext.wtf import Form

from wtforms import PasswordField, SubmitField, TextField
from wtforms.validators import Required

class LoginForm(Form):
    username = TextField('username')
    password = PasswordField('password')
    submit = SubmitField('Login')