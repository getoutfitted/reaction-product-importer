Meteor.methods({
  'productImporter/importProducts': function (productsList) {
    check(productsList, [Object]);
    //  group each Product by Product ID
    let productsById = ProductImporter.groupBy(productsList, 'productId');

    _.each(productsById, function (product) {
      let productId = ProductImporter.createTopLevelProduct(product);
      let ancestors = [productId];
      // group each variant by variant title
      let variantGroups = ProductImporter.groupBy(product, 'variantTitle');
      _.each(variantGroups, function (variantGroup) {
        let variantGroupId = ProductImporter.createMidLevelVariant(variantGroup, ancestors);
        let variantAncestors = ancestors.concat([variantGroupId]);
        // create each sub variant
        _.each(variantGroup, function (variant) {
          ProductImporter.createVariant(variant, variantAncestors);
        });
      });
    });
  },
  'productImporter/addCustomField': function (productSelector, customField) {
    check(productSelector, String);
    check(customField, Object);
    let variantLevelToBeUpdated = 'settings.customFields.' + productSelector;
    let updateObj = {};
    updateObj[variantLevelToBeUpdated] = customField;
    ReactionCore.Collections.Packages.update({
      name: 'reaction-product-importer',
      shopId: ReactionCore.getShopId()
    }, {
      $addToSet: updateObj
    });
  }
});
