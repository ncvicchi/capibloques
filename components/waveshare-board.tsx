'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role */

/** Connector map for the exact Waveshare ESP32-S3-Touch-LCD-5 SKU 28117. */
export default function WaveshareBoard() {
  return (
    <svg className="board-diagram" viewBox="0 0 760 470" role="img" aria-label="Waveshare ESP32-S3 Touch LCD 5 SKU 28117, pantalla integrada de 800 por 480">
      <title>Waveshare ESP32-S3 Touch LCD 5 · SKU 28117</title>
      <rect x="55" y="35" width="650" height="400" rx="24" fill="#244b52" stroke="#102d33" strokeWidth="8" />
      <rect x="105" y="68" width="550" height="330" rx="8" fill="#101c24" stroke="#77d5df" strokeWidth="5" />
      <text x="380" y="205" textAnchor="middle" fill="#9fffd5" fontSize="38" fontWeight="800">800 × 480</text>
      <text x="380" y="250" textAnchor="middle" fill="white" fontSize="22">Pantalla RGB + touch GT911</text>
      <text x="380" y="285" textAnchor="middle" fill="#ffd66b" fontSize="18">integrados · sin cables configurables</text>
      <g fill="#eef9f6" fontSize="15" fontWeight="700">
        <text x="90" y="420">I2C: SDA 8 · SCL 9</text>
        <text x="315" y="420">CAN: 15/16 · RS485: 43/44</text>
        <text x="585" y="420">USB: 19/20</text>
      </g>
      <rect x="18" y="145" width="55" height="72" rx="5" fill="#c5d6d5" /><text x="45" y="178" textAnchor="middle" fontSize="12">USB</text><text x="45" y="195" textAnchor="middle" fontSize="10">OTG</text>
      <rect x="687" y="128" width="55" height="105" rx="5" fill="#d7b56f" /><text x="714" y="176" textAnchor="middle" fontSize="11">BORNERA</text><text x="714" y="193" textAnchor="middle" fontSize="9">buses</text>
    </svg>
  );
}
