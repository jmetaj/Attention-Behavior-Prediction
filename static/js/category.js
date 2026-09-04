(function () {
  const params = new URLSearchParams(window.location.search);
  const selectedCategory = params.get("category") || "laptop";
  const products = window.PRODUCTS.filter(function (product) {
    return product.category === selectedCategory;
  });
  const title = document.getElementById("category-title");
  const summary = document.getElementById("category-summary");
  const grid = document.getElementById("category-products");
  const navLink = document.querySelector('[data-category-nav="' + selectedCategory + '"]');
  const categoryLabel = products[0] ? products[0].categoryLabel : "Products";

  document.title = categoryLabel + " | Product Study";
  title.textContent = categoryLabel;
  summary.textContent = "Showing only " + categoryLabel.toLowerCase() + ". Click an image to open the product page.";

  if (navLink) {
    navLink.setAttribute("aria-current", "page");
  }

  grid.innerHTML = products
    .map(function (product) {
      return [
        '<article class="product-card" data-product-id="' + product.id + '" data-category="' + product.category + '">',
        '<a class="product-image-link" href="product.html?id=' + product.id + '" aria-label="View ' + product.name + ' details">',
        '<img class="product-image" alt="' + product.alt + '" src="' + product.image_url + '" onerror="this.onerror=null;this.src=window.PRODUCT_PLACEHOLDER_IMAGE;">',
        "</a>",
        '<div class="product-body">',
        "<h2>" + product.name + "</h2>",
        '<p class="price">' + product.price + "</p>",
        '<p class="specs">' + product.specs.join("<br>") + "</p>",
        "</div>",
        "</article>",
      ].join("");
    })
    .join("");
})();
