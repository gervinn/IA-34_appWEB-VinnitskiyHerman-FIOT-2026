const products = [
  {
    id: 1,
    name: 'Big Shnak Burger',
    category: 'burger',
    price: 165,
    image: 'assets/images/burger-1.jpg',
    description: 'Соковита котлета, сир чедер, салат, томат і фірмовий соус.',
    badge: 'Хіт продажу'
  },
  {
    id: 2,
    name: 'Double Shnak',
    category: 'burger',
    price: 199,
    image: 'assets/images/burger-2.jpg',
    description: 'Подвійна котлета, подвійний сир і насичений смак для справжніх фанатів бургерів.',
    badge: 'Новинка'
  },
  {
    id: 3,
    name: 'Crispy Chicken',
    category: 'burger',
    price: 179,
    image: 'assets/images/burger-3.jpg',
    description: 'Хрустке куряче філе, салат, огірок та ніжний соус.',
    badge: 'Популярне'
  },
  {
    id: 4,
    name: 'Cola XL',
    category: 'drink',
    price: 65,
    image: 'assets/images/drink-1.jpg',
    description: 'Прохолодний газований напій великого об’єму.',
    badge: 'Напій'
  },
  {
    id: 5,
    name: 'Milk Shake',
    category: 'drink',
    price: 95,
    image: 'assets/images/drink-2.jpg',
    description: 'Вершковий молочний коктейль із ніжною текстурою.',
    badge: 'Солодке'
  },
  {
    id: 6,
    name: 'Lemon Fresh',
    category: 'drink',
    price: 79,
    image: 'assets/images/drink-3.jpg',
    description: 'Освіжаючий лимонний напій для спекотного дня.',
    badge: 'Освіжає'
  },
  {
    id: 7,
    name: 'Choco Pie',
    category: 'dessert',
    price: 89,
    image: 'assets/images/dessert-1.jpg',
    description: 'Шоколадний десерт із ніжною начинкою.',
    badge: 'Десерт'
  },
  {
    id: 8,
    name: 'Ice Cream Mix',
    category: 'dessert',
    price: 99,
    image: 'assets/images/dessert-2.jpg',
    description: 'Морозиво з топінгом на вибір і хрусткою посипкою.',
    badge: 'Холодне'
  },
  {
    id: 9,
    name: 'Apple Donut',
    category: 'dessert',
    price: 75,
    image: 'assets/images/dessert-3.jpg',
    description: 'Ароматний пончик із яблучною начинкою.',
    badge: 'До кави'
  }
];

const menuGrid = document.getElementById('menuGrid');
const filters = document.getElementById('filters');
const cartCount = document.getElementById('cartCount');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const toast = document.getElementById('toast');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const cart = document.getElementById('cart');
const openCart = document.getElementById('openCart');
const closeCart = document.getElementById('closeCart');
const cartOverlay = document.getElementById('cartOverlay');
const checkoutBtn = document.getElementById('checkoutBtn');

let selectedCategory = 'all';
let cartState = JSON.parse(localStorage.getItem('macshnaknels-cart')) || [];

function saveCart() {
  localStorage.setItem('macshnaknels-cart', JSON.stringify(cartState));
}

function renderProducts() {
  const filtered = selectedCategory === 'all'
    ? products
    : products.filter(product => product.category === selectedCategory);

  menuGrid.innerHTML = filtered.map(product => `
    <article class="menu-card reveal visible">
      <div class="menu-card__image">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="menu-card__body">
        <div class="menu-card__meta">
          <h3>${product.name}</h3>
          <span class="price">${product.price} ₴</span>
        </div>
        <p class="menu-card__desc">${product.description}</p>
        <div class="menu-card__bottom">
          <span class="badge">${product.badge}</span>
          <button class="add-btn" data-id="${product.id}">Додати</button>
        </div>
      </div>
    </article>
  `).join('');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function addToCart(id) {
  const found = cartState.find(item => item.id === id);

  if (found) {
    found.quantity += 1;
  } else {
    const product = products.find(item => item.id === id);
    cartState.push({ ...product, quantity: 1 });
  }

  saveCart();
  renderCart();
  showToast('Товар додано до кошика');
}

function changeQuantity(id, delta) {
  cartState = cartState
    .map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
    .filter(item => item.quantity > 0);

  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cartState = cartState.filter(item => item.id !== id);
  saveCart();
  renderCart();
  showToast('Товар видалено з кошика');
}

function renderCart() {
  const totalCount = cartState.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartState.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = totalCount;
  cartTotal.textContent = `${totalPrice} ₴`;

  if (!cartState.length) {
    cartItems.innerHTML = '<p class="cart__empty">Кошик порожній</p>';
    return;
  }

  cartItems.innerHTML = cartState.map(item => `
    <article class="cart-item">
      <div class="cart-item__image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item__info">
        <h4>${item.name}</h4>
        <p>${item.price} ₴ × ${item.quantity}</p>
        <div class="cart-item__actions">
          <button class="qty-btn" data-action="decrease" data-id="${item.id}">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-action="increase" data-id="${item.id}">+</button>
          <button class="remove-btn" data-action="remove" data-id="${item.id}">×</button>
        </div>
      </div>
      <strong>${item.price * item.quantity} ₴</strong>
    </article>
  `).join('');
}

filters.addEventListener('click', event => {
  const button = event.target.closest('.filter-btn');
  if (!button) return;

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  selectedCategory = button.dataset.category;
  renderProducts();
});

menuGrid.addEventListener('click', event => {
  const addButton = event.target.closest('.add-btn');
  if (!addButton) return;
  addToCart(Number(addButton.dataset.id));
});

cartItems.addEventListener('click', event => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;

  const id = Number(actionButton.dataset.id);
  const action = actionButton.dataset.action;

  if (action === 'increase') changeQuantity(id, 1);
  if (action === 'decrease') changeQuantity(id, -1);
  if (action === 'remove') removeFromCart(id);
});

burger.addEventListener('click', () => {
  nav.classList.toggle('active');
  const expanded = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!expanded));
});

document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('active');
    burger.setAttribute('aria-expanded', 'false');
  });
});

function openCartPanel() {
  cart.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCartPanel() {
  cart.classList.remove('active');
  document.body.style.overflow = '';
}

openCart.addEventListener('click', openCartPanel);
closeCart.addEventListener('click', closeCartPanel);
cartOverlay.addEventListener('click', closeCartPanel);

checkoutBtn.addEventListener('click', () => {
  if (!cartState.length) {
    showToast('Спочатку додай товари до кошика');
    return;
  }

  showToast('Замовлення успішно оформлено');
  cartState = [];
  saveCart();
  renderCart();
  closeCartPanel();
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

renderProducts();
renderCart();
