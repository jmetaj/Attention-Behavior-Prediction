(function () {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const product = window.PRODUCTS.find(function (item) {
    return item.id === productId;
  });
  const container = document.getElementById("product-detail");

  if (!product) {
    document.title = "Product not found | Tech Store";
    container.innerHTML = [
      '<section class="intro">',
      '<p class="eyebrow">Product Details</p>',
      "<h1>Product not found</h1>",
      '<p class="summary">Choose a product from the home page or category pages.</p>',
      "</section>",
    ].join("");
    return;
  }

  document.title = product.name + " | Tech Store";
  container.dataset.productId = product.id;
  container.dataset.category = product.category;
  container.innerHTML = [
    '<div class="detail-media">',
    '<img class="detail-image" alt="' + product.alt + '" src="' + product.image_url + '" onerror="this.onerror=null;this.src=window.PRODUCT_PLACEHOLDER_IMAGE;">',
    "</div>",
    '<section class="detail-info">',
    '<p class="eyebrow">' + product.categoryLabel + "</p>",
    "<h1>" + product.name + "</h1>",
    '<p class="price detail-price">' + product.price + "</p>",
    '<p class="summary">' + product.details + "</p>",
    '<dl class="detail-specs">',
    product.specs
      .map(function (spec, index) {
        return "<dt>Feature " + (index + 1) + "</dt><dd>" + spec + "</dd>";
      })
      .join(""),
    "</dl>",
    '<a class="back-link" href="category.html?category=' + product.category + '">Back to ' + product.categoryLabel + "</a>",
    "</section>",
  ].join("");
})();
