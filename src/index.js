import "./css/main.scss";
import Alpine from 'alpinejs'
import intersect from '@alpinejs/intersect'

Alpine.magic('yPosition', (el) => {
  let rect = el.getBoundingClientRect(),
  scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return rect.top + scrollTop;
})

Alpine.directive('cl_type', (el, { expression }, { evaluateLater, effect }) => {

  let getCommandToType = evaluateLater(expression),
      typingIndex,
      lastCommand,
      interval,
      history = [];

  effect(() => {
    getCommandToType(commandToType => {

        // Check if already typing, if so clear interval and restart
        if(interval) {
          clearInterval(interval);
          el.innerText = history.join('\n');
        }

        // Check to see if new command is just extension of previous, if so pick back up where it changes
        typingIndex = 0;
        if(lastCommand) {
          while(typingIndex < lastCommand.length && lastCommand.charAt(typingIndex) == commandToType.charAt(typingIndex)) {
            typingIndex++;
          }
        }

        if(commandToType.toLowerCase() === '^c') {
          // Cancel
          if(lastCommand !== '\n' && lastCommand !== '^c') {
            history.pop();
            el.innerText = history.join('\n');
          }
        } else if(commandToType === '\n') {
          // Execute
          let confirmation = '';
          if(lastCommand) {
            confirmation = 'CREATE SOURCE';
            if(lastCommand.indexOf('DROP') === 0) confirmation = 'DROP SOURCE';
            if(lastCommand.indexOf('CREATE MAT') === 0) confirmation = 'CREATE VIEW';
          }
          history.push(confirmation + '\nmz=> ');
          el.innerText = history.join('\n');
        } else {
          let scrollback = history.join('\n') + '\n';
          let tempct = 0;
          // Add new command to history
          history.push('mz=> ' + commandToType.replace(/\n/g, '\nmz-> '));
          
          interval = setInterval(function() {
            tempct++;
            if(tempct > 1000) { console.log('something wrong');}
            typingIndex += Math.floor(Math.random() * 12)
            el.innerText = scrollback + history.at(-1).substring(0, typingIndex);
            if(typingIndex >= history.at(-1).length) {
              clearInterval(interval);
            }
          }, 32);
        }
        lastCommand = commandToType;
    })
  })
})

Alpine.plugin(intersect)

window.Alpine = Alpine
Alpine.start()

// JS Goes here - ES6 supported
if (window.netlifyIdentity) {
  window.netlifyIdentity.on("init", (user) => {
    if (!user) {
      window.netlifyIdentity.on("login", () => {
        document.location.href = "/admin/";
      });
    }
  });
}

const palette = ['#AD37E5', '#E537C0', '#EE8660', '#221EFF', '#1AEEFF', '#39D7E1', '#13D461', '#D1FA77'];

/* Generate the SVG for Step 1: */
const drawDB = function(row_cts) {
  let svg = '<svg class="olap fill read" width="480" height="340" viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg">',
      table_ct = row_cts.length,
      max_w = 280,
      max_h = 280,
      midpt_y = max_h/2,
      max_grid = 20,
      read_delay = 4000,
      total_rows = row_cts.reduce((partial_sum, a) => partial_sum + a[0], 0),
      max_cols = row_cts.reduce((max, a) => a[1] > max ? a[1] : max, 0),
      grid = Math.floor((max_h - ((table_ct-1) * max_grid)) / total_rows),
      t_y_start = grid * 1.5,
      t_x_start = 160,
      max_t_x_end = t_x_start + (max_cols * grid);
      
  if(grid > max_grid) grid = max_grid;
  
  for (let t=0; t<table_ct; t++) {
    let col_ct = row_cts[t][1],
        t_x_end = t_x_start + (col_ct * grid),
        color = palette.splice(Math.floor(Math.random() * palette.length), 1);
    svg += `<g class=" t_${t}"><rect class="t_outline" x="${t_x_start - 2}" y="${t_y_start - 8}" width="${grid*col_ct+4}" height="${grid*row_cts[t][0]}"/>`;
    for (let r=0; r<row_cts[t][0]; r++) {
      let y_pos = t_y_start + (r * grid);
      svg += `<g class="r r_${r}"><rect class="cell" x="${t_x_start}" y="${y_pos-(grid/2)}" width="${grid*col_ct}" height="1"/>`;
      for (let c=0; c<col_ct; c++) {
        svg += `<path class="w c_${c}" stroke="${(c==0) ? color : '#CCC'}" d="M ${t_x_start+((c+1)*grid)} ${y_pos} L ${t_x_start} ${y_pos} C ${t_x_start-40} ${y_pos} ${t_x_start-40} ${midpt_y} ${t_x_start-80} ${midpt_y} L ${40-(c*grid)} ${midpt_y}" stroke-dasharray="${grid/2} ${(c*grid)+400}" stroke-dashoffset="-${(c*grid)+400}" style="animation-delay: ${(c*20) + (r*100) + (t*500)}ms;" />`;
        
      } 
      svg += `</g><path class="r" d="M ${max_t_x_end+120} ${midpt_y} L ${max_t_x_end+80} ${midpt_y} C ${max_t_x_end+40} ${midpt_y} ${max_t_x_end+40} ${y_pos-(grid*(r+0.5))} ${max_t_x_end} ${y_pos-(grid*(r+0.5))} L ${t_x_start} ${y_pos-(grid*(r+0.5))} L ${t_x_start} ${y_pos} L ${t_x_end} ${y_pos}" stroke-dasharray="200 500" stroke-dashoffset="-500" style="animation-delay: ${read_delay}ms;" />`;
      read_delay += 250;
    }
    svg += '</g>';
    t_y_start += (row_cts[t][0]+1.5) * grid;
  }
  return svg + `<rect class="db_outline" x="60" y="2" rx="8" width="${max_w}" height="${max_h+40}"/>
  <rect class="write_trigger" x="30" y="${midpt_y-15}" width="60" height="30" rx="5" fill="${palette[4]}" />
  <text x="40" y="${midpt_y+5}" fill="#000">Write</text>
  <rect class="read_trigger" x="${max_w+30}" y="${midpt_y-15}" width="60" height="30" rx="5" fill="${palette[1]}" />
  <text x="${max_w+40}" y="${midpt_y+5}" fill="#000">Read</text>
  </svg>`;
}

document.querySelector('#slide_0 .graphic').innerHTML = drawDB([[3,5],[5,7],[7,3]]);



function optSelect() {
  return {
    open: false,
    textInput: '',
    opts: [],
    suggestions: [],
    init() {
      this.suggestions = JSON.parse(this.$el.parentNode.getAttribute('data-suggestions'));
      this.opts = JSON.parse(this.$el.parentNode.getAttribute('data-selections'));
    },
    addOpt(opt) {
      opt = opt.trim()
      if (opt != "" && !this.hasOpt(opt)) {
        this.opts.push( opt )
      }
      this.clearSearch()
      this.$refs.textInput.focus()
      this.fireOptsUpdateEvent()
    },
    fireOptsUpdateEvent() {
      this.$el.dispatchEvent(new CustomEvent('opts-update', {
        detail: { opts: this.opts },
        bubbles: true,
      }));
    },
    hasOpt(opt) {
      var opt = this.opts.find(e => {
        return e.toLowerCase() === opt.toLowerCase()
      })
      return opt != undefined
    },
    removeOpt(index) {
      this.opts.splice(index, 1)
      this.fireOptsUpdateEvent()
    },
    search(q) {
      if ( q.includes(",") ) {
        q.split(",").forEach(function(val) {
          this.addOpt(val)
        }, this)
      }
      this.toggleSearch()
    },
    clearSearch() {
      this.textInput = ''
      this.toggleSearch()
    },
    toggleSearch() {
      this.open = this.textInput != ''
    }
  }
}