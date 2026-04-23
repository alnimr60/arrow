import { create } from 'twrnc';
// Default config but with our key colors added
const tw = create({
  theme: {
    extend: {
      colors: {
        'bg-main': '#0f172a',
        'accent-cyan': '#22d3ee',
        'accent-purple': '#818cf8',
        'text-dim': '#94a3b8',
      },
    },
  },
});
export default tw;
