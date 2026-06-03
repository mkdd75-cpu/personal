<script setup>
import { ref } from 'vue'

let pressed = ref('')
const operand1 = ref('')
const operand2 = ref('')
const result = ref()
const showResult = ref(false)
const currentOp = ref('')
let waitingForNext = false
const operations = ['-', '+', '*', '/', '%']

function showDisplay() {
  showResult.value = !showResult.value;
}

function allClear() {
  operand1.value = ''
  operand2.value = ''
  currentOp.value = ''
  result.value = ''
  console.log("All Clear!!")
  waitingForNext = false
}

function backSpace() {
  if (waitingForNext) {
    operand2.value = operand2.value.slice(0, -1)  
  } else {
    operand1.value = operand1.value.slice(0, -1)          
  }
}

function operation(event) {
  pressed = event.target.innerText
  if (!operations.includes(pressed) && pressed != '=') {
    if (waitingForNext) {
      operand2.value += pressed
    }
    else {
      operand1.value += pressed
    }
  }
  else if (operations.includes(pressed)) {
    currentOp.value = pressed
    waitingForNext = true
  }
  else if (pressed === '=') {
    if (currentOp.value == '+') {
      // console.log("op1 = ", operand1.value + "op2 =", operand2.value)
      result.value = Number(operand1.value) + Number(operand2.value)
      operand1.value = result.value
      operand2.value = ''
    }
    else if (currentOp.value == '-') {
      // console.log("op1 = ", operand1.value + "op2 =", operand2.value)
      result.value = Number(operand1.value) - Number(operand2.value)
      operand1.value = result.value
      operand2.value = ''
    }

    else if (currentOp.value == '*') {
      // console.log("op1 = ", operand1.value + "op2 =", operand2.value)
      result.value = Number(operand1.value) * Number(operand2.value)
      operand1.value = result.value
      operand2.value = ''
    }
    else if (currentOp.value == '/') {
      // console.log("op1 = ", operand1.value + "op2 =", operand2.value)
      result.value = Number(operand1.value) / Number(operand2.value)
      operand1.value = result.value
      operand2.value = ''
    }
    else if (currentOp.value == '%') {
      // console.log("op1 = ", operand1.value + "op2 =", operand2.value)
      result.value = Number(operand1.value) % Number(operand2.value)
      operand1.value = result.value
      operand2.value = ''
    }
    showResult.value = !showResult.value;
    console.log("result.value = ", result.value)

  }

}

</script>

<template>
  <div class="keypad-container">
    <!-- <button @click="operation($event)">1234</button> -->
    <!-- <p>{{ operand1 }}</p> -->

    <div class="display">
      <input type="text" :value="operand1" class="input-field" v-if="!showResult">
      <input type="text" :value="currentOp" class="input-field" v-if="!showResult">
      <input type="text" :value="operand2" class="input-field" v-if="!showResult">
      <input type="text" :value="result" class="results-field" v-if="showResult">
    </div>
    <div>
      <button @click="showDisplay">Back</button>
      <button @click="allClear">AC</button>
      <button @click="backSpace">⌫</button>
      <button @click="operation($event)">/</button>
    </div>
    <div>
      <button @click="operation($event)">1</button>
      <button @click="operation($event)">2</button>
      <button @click="operation($event)">3</button>
      <button @click="operation($event)">+</button>
    </div>
    <div>
      <button @click="operation($event)">4</button>
      <button @click="operation($event)">5</button>
      <button @click="operation($event)">6</button>
      <button @click="operation($event)">-</button>
    </div>
    <div>
      <button @click="operation($event)">7</button>
      <button @click="operation($event)">8</button>
      <button @click="operation($event)">9</button>
      <button @click="operation($event)">*</button>
    </div>
    <div>
      <button @click="operation($event)">0</button>
      <button @click="operation($event)">.</button>
      <button @click="operation($event)">%</button>
      <button @click="operation($event)">=</button>
    </div>

  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.keypad-container {
  background-color: #1c1c1e;
  border-radius: 20px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 40px auto;
}

.display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: #2c2c2e;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
}

.input-field,
.results-field {
  background: transparent;
  border: none;
  outline: none;
  text-align: right;
  font-size: 1.2rem;
  color: #ffffff;
  width: 100%;
  padding: 4px 8px;
}

.results-field {
  font-size: 2rem;
  font-weight: bold;
  color: #f0a500;
  border-top: 1px solid #3a3a3c;
  padding-top: 8px;
  margin-top: 4px;
}

/* --- Button rows --- */
div {
  display: flex;
  gap: 10px;
}

button {
  flex: 1;
  height: 60px;
  border: none;
  border-radius: 50%;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.1s ease, transform 0.1s ease;
  background-color: #3a3a3c;
  color: #ffffff;
}

button:active {
  filter: brightness(1.4);
  transform: scale(0.95);
}

/* operator buttons: +, -, *, /, % */
div:nth-child(2) button:last-child,
div:nth-child(3) button:last-child,
div:nth-child(4) button:last-child,
div:nth-child(5) button:last-child,
div:nth-child(6) button:last-child {
  background-color: #f0a500;
  color: #ffffff;
}

/* top row: Back, AC, ⌫, / */
div:nth-child(2) button:nth-child(1),
div:nth-child(2) button:nth-child(2),
div:nth-child(2) button:nth-child(3) {
  background-color: #636366;
  color: #ffffff;
}

/* = button */
div:last-child button:last-child {
  background-color: #f0a500;
  color: #ffffff;
}
</style>
