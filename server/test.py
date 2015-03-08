#!flask/bin/python
import os
import unittest

from server import app, db
import User

class TestCase(unittest.TestCase):
    def setUp(self):
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'test1.db')
        self.app = app.test_client()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()

    def test_user_create(self):
        u = User(username='andy', password='example')
        assert u.username == 'andy'
        assert u.password == 'example'

if __name__ == '__main__':
    unittest.main()