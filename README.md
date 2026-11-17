# BJT-LAB-X: Interactive BJT Circuit Analysis Platform

An interactive educational platform designed for the comprehensive analysis and simulation of a **BJT Current Amplifier Switch for High-Decibel Doorbell Buzzers** (PS-37).

The system interfaces a weak sensor signal (**2 mA at 3.3 V**) with a high-current doorbell buzzer drawing **100 mA at 12 V** ($R_L = 120\,\Omega$) using an NPN transistor (**2N2222, minimum gain $\beta = 80$**) operating in saturation and cut-off modes.

The platform evaluates the available base drive and saturation feasibility ($V_{CE(sat)} \le 0.2\,\text{V}$ target), calculates the **maximum-drive base resistance at the 2 mA limit** ($R_B = 1.3\,\text{k}\Omega$), verifies safe power dissipation in the BJT, and integrates a **1N4001 flyback diode** to clamp inductive back-EMF spikes.

> [!IMPORTANT]
> ### ⚠️ Critical Technical Analysis: Base Drive vs. Deep Saturation
> - **Theoretical Minimum Resistance:** $R_B = 1.3\,\text{k}\Omega$ is a theoretical minimum calculated under the assumed $0.7\,\text{V}$ base-emitter voltage and $3.3\,\text{V}$ loaded input:
>   $$I_B = \frac{3.3\,\text{V} - 0.7\,\text{V}}{1300\,\Omega} = 2.0\,\text{mA}$$
>   For a $100\,\text{mA}$ buzzer load, the forced beta is:
>   $$\beta_{\text{forced}} = \frac{I_C}{I_B} = \frac{100\,\text{mA}}{2\,\text{mA}} = 50$$
> - **1.6× Overdrive Context:** The nominal $1.6\times$ figure comes strictly from comparing the $2.0\,\text{mA}$ base drive with the active-region estimate ($I_C / \beta = 100\,\text{mA} / 80 = 1.25\,\text{mA}$). An increase in base drive is *not* equivalent to proof of deep saturation.
> - **Datasheet Confirmation Requirement:** Standard switching specifications for the 2N2222 characterize deep saturation ($V_{CE(sat)} \le 0.2\,\text{V}$) at $\beta_{\text{forced}} \le 10$ ($I_B = 10\,\text{mA}$). Operating at $\beta_{\text{forced}} = 50$ evaluates saturation feasibility; confirming that the physical transistor achieves $V_{CE(sat)} \le 0.2\,\text{V}$ **still requires datasheet curve confirmation or direct bench measurement**.

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

