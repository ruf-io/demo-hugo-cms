import "./css/main.scss";
import Alpine from 'alpinejs'
import intersect from '@alpinejs/intersect'


Alpine.magic('yPosition', (el) => {
  let rect = el.getBoundingClientRect(),
  scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return rect.top + scrollTop;
})

Alpine.directive('cl_type', (el, { expression }, { evaluateLater, effect }) => {

  let getCommandToType = evaluateLater(expression);
  let index = 5;
  let interval;

  effect(() => {
    getCommandToType(commandToType => {
        if(interval) clearInterval(interval);
        index = 5;
        while(index < el.innerText.length && el.innerText.charAt(index+5) == commandToType.charAt(index)) {
          index++;
        }
        console.log(index);
        interval = setInterval(function() {
          index += Math.floor(Math.random() * 12)
          console.log('wtf');
          el.innerText = 'mz=> ' + commandToType.substr(0, index);
          if(index >= commandToType.length) {
            clearInterval(interval);
          }
        }, 32);
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

console.log("🦊 Hello! Edit me in src/index.js");
