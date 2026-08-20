/** @type {import('tailwindcss').Config} */
module.exports={
  content:["./index.html","./src/**/*.{ts,tsx}"],
  theme:{extend:{
    colors:{
      ink:"#09090B",panel:"#111114",panel2:"#17171C",line:"#29292F",
      violet:"#8B5CF6",violet2:"#B79CFF",muted:"#94949D"
    },
    boxShadow:{glow:"0 14px 45px rgba(139,92,246,.20)"},
    borderRadius:{xl2:"18px"}
  }},
  plugins:[]
}
