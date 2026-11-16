"""
BJT LABX - Interactive BJT Circuit Analysis Website
Flask Application Entry Point
"""
from flask import Flask, render_template

app = Flask(__name__)


@app.route('/')
def home():
    """Home page - landing page with project overview."""
    return render_template('home.html', active_page='home')


@app.route('/circuit')
def circuit():
    """Circuit Diagram page - interactive BJT buzzer driver circuit."""
    return render_template('circuit.html', active_page='circuit')


@app.route('/calculations')
def calculations():
    """Calculations page - detailed BJT circuit calculations."""
    return render_template('calculations.html', active_page='calculations')


@app.route('/graph')
def graph():
    """Graph page - interactive BJT characteristics graph."""
    return render_template('graph.html', active_page='graph')


@app.route('/about')
def about():
    """About page - project information and team details."""
    return render_template('about.html', active_page='about')


if __name__ == '__main__':
    app.run(debug=True, port=5000)

