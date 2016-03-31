ProductImporter.existingProduct = function (product, type = 'variant') {
  check(product, Object);
  check(type, String);
  if (type === 'simple') {
    return ReactionCore.Collections.Products.findOne({
      title: product.title,
      vendor: product.vendor,
      ancestors: product.ancestors,
      type: type,
      handle: product.handle
    });
  }
  return ReactionCore.Collections.Products.findOne({
    title: product.title,
    ancestors: product.ancestors,
    type: type
  });
};

ProductImporter.anyCustomFields = function (level) {
  check(level, String);
  let validLevels = ['topProduct', 'midVariant', 'variant'];
  if (!_.contains(validLevels, level)) {
    ReactionCore.Log.warn('Customized Import does not match level');
    return false;
  }
  let productImporter = ReactionCore.Collections.Packages.findOne({
    name: 'reaction-product-importer',
    shopId: ReactionCore.getShopId()
  });
  if (productImporter) {
    return productImporter.settings.customFields[level].length >= 1;
  }
};
ProductImporter.customFields = function (level) {
  check(level, String);
  let validLevels = ['topProduct', 'midVariant', 'variant'];

  if (!_.contains(validLevels, level)) {
    ReactionCore.Log.warn('Customized Import does not match level');
    return false;
  }
  let productImporter = ReactionCore.Collections.Packages.findOne({
    name: 'reaction-product-importer',
    shopId: ReactionCore.getShopId()
  });
  if (productImporter && productImporter.settings && productImporter.settings.customFields) {
    return productImporter.settings.customFields[level];
  }
};

ProductImporter.groupBy = function (productList, groupIdentifier) {
  check(productList, [Object]);
  check(groupIdentifier, String);
  return _.groupBy(productList, function (product) {
    return product[groupIdentifier];
  });
};

ProductImporter.parseByType = function (value, valueType) {
  check(value, String);
  check(valueType, String);
  switch (valueType) {
  case 'number':
    return parseFloat(value, 10);
  case 'boolean':
    return JSON.parse(value.toLowerCase());
  default:
    return value;
  }
};

ProductImporter.createTopLevelProduct = function (product) {
  check(product, [Object]);
  let baseProduct = product[0];
  let sameProduct = _.every(product, function (item) {
    const result = baseProduct.productTitle === item.productTitle;
    return result;
  });
  if (!sameProduct) {
    ReactionCore.Log.warn('One or more Products with productId ' + baseProduct.productId + ' have different product titles');
  }
  let maxPricedProduct = _.max(product, function (item) {
    return parseInt(item.price, 10);
  });
  let maxPrice = maxPricedProduct.price;
  let minPricedProduct = _.min(product, function (item) {
    return parseInt(item.price, 10);
  });
  let minPrice = minPricedProduct.price;
  let prod = {};
  prod.ancestors = [];
  prod.shopId = ReactionCore.getShopId();
  prod.title = baseProduct.productTitle;
  prod.vendor = baseProduct.vendor;
  prod.pageTitle = baseProduct.pageTitle;
  prod.handle = baseProduct.handle.toLowerCase().trim();
  prod.handle = prod.handle.replace(/\s/, '-');
  prod.isVisible = false;
  prod.description = baseProduct.description;
  prod.price = {};
  prod.price.max = maxPrice;
  prod.price.min = minPrice;
  prod.price.range = minPrice + '-' + maxPrice;
  if (this.anyCustomFields('topProduct')) {
    let customFields = this.customFields('topProduct');
    _.each(customFields, function (customField) {
      let result = ProductImporter.parseByType(baseProduct[customField.csvColumnName], customField.valueType);
      prod[customField.productFieldName] = result;
    });
  }
  let existingProduct = this.existingProduct(prod, 'simple');
  if (existingProduct) {
    ReactionCore.Log.warn('Found product = ' + existingProduct._id);
    ReactionCore.Log.warn(existingProduct.vendor + ' ' + existingProduct.title + ' has already been added.');
    return existingProduct._id;
  }
  let reactionProductId = ReactionCore.Collections.Products.insert(prod, {selector: {type: 'simple'}});
  ReactionCore.Log.info(prod.vendor + ' ' + prod.title + ' was successfully added to Products.');
  return reactionProductId;
};

ProductImporter.createMidLevelVariant = function (variant, ancestors) {
  check(variant, [Object]);
  check(ancestors, [String]);
  let baseVariant = variant[0];
  let sameVariant = _.every(variant, function (item) {
    return baseVariant.variantTitle === item.variantTitle;
  });
  if (!sameVariant) {
    ReactionCore.Log.warn('One or more Products with variantTitle ' + baseVariant.variantTitle + ' have different variant titles');
  }
  let inventory = _.reduce(variant, function (sum, item) {
    return sum + parseInt(item.qty, 10);
  }, 0);
  let prod = {};
  prod.ancestors = ancestors;
  prod.isVisible = false;
  prod.type = 'variant';
  prod.title = baseVariant.variantTitle;
  prod.price = baseVariant.price;
  prod.inventoryQuantity = inventory;
  prod.weight = parseInt(baseVariant.weight, 10);
  prod.shopId = ReactionCore.getShopId();
  prod.taxable = baseVariant.taxable.toLowerCase() === 'true';
  if (this.anyCustomFields('midVariant')) {
    let customFields = this.customFields('midVariant');
    _.each(customFields, function (customField) {
      let result = ProductImporter.parseByType(baseVariant[customField.csvColumnName], customField.valueType);
      prod[customField.productFieldName] = result;
    });
  }
  let existingVariant = this.existingProduct(prod);
  if (existingVariant) {
    ReactionCore.Log.warn('Found product = ' + existingVariant._id);
    ReactionCore.Log.warn(existingVariant.title + ' has already been added.');
    return existingVariant._id;
  }
  let reactionVariantId = ReactionCore.Collections.Products.insert(prod, {selector: {type: 'variant'}});
  ReactionCore.Log.info(prod.title + ' was successfully added to Products as a variant.');
  return reactionVariantId;
};

ProductImporter.createVariant = function (variant, ancestors) {
  check(variant, Object);
  check(ancestors, [String]);
  let prod = {};
  prod.ancestors = ancestors;
  prod.isVisible = false;
  prod.type = 'variant';
  prod.title = variant.title;
  prod.optionTitle = variant.optionTitle;
  prod.price = variant.price;
  prod.inventoryQuantity = parseInt(variant.qty, 10);
  prod.weight = parseInt(variant.weight, 10);
  prod.shopId = ReactionCore.getShopId();
  prod.taxable = variant.taxable.toLowerCase() === 'true';
  if (this.anyCustomFields('variant')) {
    let customFields = this.customFields('variant');
    _.each(customFields, function (customField) {
      let result = ProductImporter.parseByType(variant[customField.csvColumnName], customField.valueType);
      prod[customField.productFieldName] = result;
    });
  }
  let existingVariant = this.existingProduct(prod);
  if (existingVariant) {
    ReactionCore.Log.warn('Found product = ' + existingVariant._id);
    ReactionCore.Log.warn(existingVariant.title + ' has already been added.');
    return existingVariant._id;
  }
  let reactionVariantId = ReactionCore.Collections.Products.insert(prod, {selector: {type: 'variant'}});
  ReactionCore.Log.info(prod.title + ' was successfully added to Products as a variant.');
  return reactionVariantId;
};
