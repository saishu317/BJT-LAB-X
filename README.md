# BJT-LAB-X: Interactive BJT Circuit Analysis Platform

An interactive educational platform designed for the comprehensive analysis and simulation of a **BJT Current Amplifier Switch for High-Decibel Doorbell Buzzers** (PS-37).

The system interfaces a weak sensor signal (**2 mA at 3.3 V**) with a high-current doorbell buzzer drawing **100 mA at 12 V** ($R_L = 120\,\Omega$) using an NPN transistor (**2N2222, minimum gain $\beta = 80$**) operating in saturation and cut-off modes.

---

## ⚡ Features

- **Interactive Circuit Simulation**: Real-time visualization of BJT operation under varying base resistance values.
- **Dynamic Calculations**: Live calculations for base resistance ($R_B$), base current ($I_B$), collector current ($I_C$), and power dissipation ($P_D$).
- **Transistor Characteristics Graph**: Dynamic IC vs. VCE curves with load lines and operating point (Q-point) tracking across Cut-off, Active, and Saturation regions.
- **Inductive Kickback Protection**: Demonstrates the function of the 1N4001 flyback clamp diode.
- **Modern Responsive UI**: Dark sci-fi/lab aesthetic built with CSS animations, glowing HUD indicators, and mobile-friendly layouts.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask
- **Frontend**: HTML5, CSS3, Modern JavaScript (ES6+)
- **Icons & Visuals**: FontAwesome, Canvas / SVG rendering

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- `pip`

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/saishu317/BJT-LAB-X.git
   cd BJT-LAB-X
   ```

2. **Create and activate a virtual environment (optional but recommended):**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the application:**
   ```bash
   python app.py
   ```

5. **Open in browser:**
   Navigate to `http://localhost:5000`

---

## 👥 Project Team

- **Sai Krishna B V** (RA2511004011008)
- **Sanjay Babu** (RA2511004011011)
- **Amalesh MS** (RA2511004011017)

Under guidance of **Dr. Md Jawaid Alam** (SRM Institute of Science and Technology).

---

## 📄 License

This project is licensed for educational and academic use.

