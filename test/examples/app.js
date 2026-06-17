function greet(name) {
  const symbols = '<>&"\'`'
  return `Hello, ${name}! ${symbols}`
}

module.exports = { greet }
