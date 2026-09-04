(function () {
  const DATA_BASE = window.location.port === "5500" ? "http://127.0.0.1:5000" : "";
  const PLACEHOLDER_IMAGE = DATA_BASE + "/static/images/placeholder-product.svg";
  const request = new XMLHttpRequest();
  let PRODUCTS = [];

  request.open("GET", DATA_BASE + "/data/products.json", false);
  request.send(null);

  if (request.status >= 200 && request.status < 300) {
    PRODUCTS = JSON.parse(request.responseText).map(function (product) {
      if (product.image_url && product.image_url.charAt(0) === "/") {
        product.image_url = DATA_BASE + product.image_url;
      }
      return Object.assign({ image: product.image_url }, product);
    });
  }

  window.PRODUCT_PLACEHOLDER_IMAGE = PLACEHOLDER_IMAGE;
  window.PRODUCT_IMAGE_FILES = PRODUCTS.map(function (item) { return item.image; });
  window.getProductImage = function (product) { return product.image || PLACEHOLDER_IMAGE; };
  window.PRODUCTS = PRODUCTS;
})();
