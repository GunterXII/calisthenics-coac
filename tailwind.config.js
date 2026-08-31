/** @type {import('tailwindcss').Config} */
module.exports={
  content:["./index.html","./src/**/*.{ts,tsx}"],
  theme:{extend:{
    colors:{
      ink:"#09090B",panel:"#111114",panel2:"#17171C",line:"#29292F",
      violet:"#B8F500",violet2:"#D7FF5A",muted:"#94949D"
    },
    boxShadow:{glow:"0 14px 45px rgba(184,245,0,.16)"},
    borderRadius:{xl2:"18px"}
  }},
  plugins:[]
}
