from flask import render_template, flash, redirect, session, url_for, request, g
from flask.ext.login import login_user, logout_user, current_user, \
    login_required

from app import login_manager, app
from .forms import LoginForm

@login_manager.user_loader
def load_user(userid):
    return User.query.get(userid)

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
