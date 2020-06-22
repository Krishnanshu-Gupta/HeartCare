
/**
 * Product options / variant management
 */
(function(t){

    function onAddToCart(ev) {
        ev.preventDefault();

        var $form            = $(ev.target),
            data             = {form_fields: {}},
            submit_btn       = theme.ladda.create($form.find('button[type=submit]:visible')[0]),
            alternate_btn    = theme.ladda.create($form.find('button[name=alternate-btn]:visible')[0]),
            $btns            = $form.find('.add-product-btns'),
            $success_options = $form.find('.add-product-success'),
            redirect_to      = $form.data('redirect_to');

        // validate form
        if (theme.bsFormValidate($form[0]) === false) {
            ev.stopPropagation();
            return;
        }

        // compile data
        $.each($form.gc_serializeArray(), function(i,k){
            theme.data_set(data, k.name, k.value);
        });

        data.quantity = $form.find('.form-control[name=quantity]:visible').val();

        // loading button
        if (redirect_to) {
            alternate_btn.start();
        } else {
            submit_btn.start();
        }

        Givecloud.Cart().addProduct(data)
            .then(function(checkout){
                if (redirect_to) {
                    top.location.href = redirect_to;
                } else {
                    $btns.slideUp();
                    $success_options.slideDown();
                    theme.toast.success('Added to your cart!');
                }
            })
            .catch(function(err){
                theme.toast.error(err);
                //theme.toast.error("Oh no! There was a problem. Can you try again?\n\nIf it still doesn't work, can you contact us and let us know right away?! Thank you!");
            }).finally(function(err){
                 submit_btn.stop();
            });
    }

    function init($form) {
        $form = $($form);

        function onVariantChange($element){
            var $pricingContainer = $form.find('.pricing-container'),
                $amt              = $form.find('input[name=amt]'),
                $frequency        = $form.find('input[name=recurring_frequency]'),
                currency_code     = $form.find('select[name=currency_code]').val() || Givecloud.config.currency.code,
                currency_symbol   = Givecloud.config.currency.symbol,
                exchange_rate     = Givecloud.config.currency.rate,
                hide_pricing      = $pricingContainer.data('hide-pricing') || false,
                default_amt       = theme.toNumber($amt.val()),
                product_meta      = '';

            Givecloud.config.currencies.forEach(function(currency) {
                if (currency.code === currency_code) {
                    currency_symbol = currency.symbol;
                    exchange_rate = currency.rate;
                }
            });

            $pricingContainer.empty();

            if (!$element.length) {
                return;
            }

            var data = {
                'variant_id'     : theme.toNumber($element.val()),
                'price'          : theme.toNumber($element.data('price')),
                'on_sale'        : $element.data('on-sale') ? true : false,
                'sale_price'     : theme.toNumber($element.data('sale-price')),
                'billing_period' : $element.data('billing-period'),
                'redirects_to'   : $element.data('redirect'),
                'donation'       : $element.data('donation') ? true : false,
                'price_presets'  : $element.data('price-presets') ? String($element.data('price-presets')).split(',') : null,
                'price_presets_other' : $element.data('price-preset-other') || 'Other',
                'minimum_price'  : theme.toNumber($element.data('minimum-price')) * exchange_rate,
                'other_amount'   : theme.toNumber($element.data('other-amount')),
                'available'      : $element.data('available'),
                'shipping_expectation' : $element.data('shipping-expectation'),
                'out_of_stock_message' : $element.data('out-of-stock-message'),
                'first_payment'  : $element.data('recurring-first-payment')
            };

            if (data.other_amount && data.redirects_to) {
                data.redirects_to = URI(data.redirects_to).addSearch('amount', data.other_amount).toString();
            }

            if (!data.donation && $pricingContainer.hasClass('donation-only')) {
                $pricingContainer = $('<div/>');
            }

            if (data.redirects_to) {
                top.location.href = data.redirects_to;
            }

            var bill_period_short = '';
            if (data.billing_period == 'weekly') {
                bill_period_short = 'week';
            } else if (data.billing_period == 'biweekly') {
                bill_period_short = 'bi-weekly';
            } else if (data.billing_period == 'monthly') {
                bill_period_short = 'month';
            } else if (data.billing_period == 'quarterly') {
                bill_period_short = 'quarter';
            } else if (data.billing_period == 'biannually') {
                bill_period_short = 'bi-annually';
            } else if (data.billing_period == 'annually') {
                bill_period_short = 'year';
            }

            $frequency.val((data.billing_period == 'onetime') ? null : data.billing_period).change();

            if (data.donation) {
                if (data.price_presets) {
                    var $presets = $('<div class="btn-group-toggle form-primary btn-group-checked d-inline-block price-presets" data-toggle="buttons"></div>').appendTo($pricingContainer);
                    $.each(data.price_presets, function(i, price){
                        if (price == 'other') {
                            $option = $('<div class="form-group d-inline-block mb-1 mr-1 labelify bs-validate">' +
                                    '<label for="p-variant-id-' + data.variant_id + '">' + data.price_presets_other + '</label>' +
                                    '<input id="p-variant-id-' + data.variant_id + '" style="width:120px;" type="number" step="0.01" class="font-weight-bold form-control form-control-outline" name="other_amount" value="">' +
                                '</div>').appendTo($presets);
                        } else {
                            $option = $('<label class="btn btn-lg btn-outline-primary mb-1 mr-1"><input type="radio" name="preset_amount" value="'+price+'"> '+currency_symbol+price+'</small></label>').appendTo($presets);
                        }
                    });
                } else {
                    $option = $('<div class="form-group d-inline-block mb-1 mr-1 labelify bs-validate">' +
                            '<label for="p-variant-id-' + data.variant_id + '">Amount</label>' +
                            '<input id="p-variant-id-' + data.variant_id + '" style="width:170px;" type="number" step="0.01" class="form-control form-control-outline" name="other_amount" value="">' +
                        '</div>').appendTo($pricingContainer);
                }

                var $otherAmount = $pricingContainer.find('input[name=other_amount]');

                $pricingContainer.find('input[name=preset_amount]').change(function(ev){
                    ev.preventDefault();
                    $amt.val($(ev.target).val()).change();
                    if ($otherAmount.length) {
                        $otherAmount.val('').removeAttr('required');
                    }
                });

                if ($otherAmount.length) {
                    $otherAmount.focus(function(){
                        $pricingContainer.find('input[name=preset_amount]:checked').each(function(i, el){
                            $(el).prop('checked', false).parent().removeClass('active');
                            $amt.val($otherAmount.val()).change();
                        });
                        $otherAmount.attr('required', true);
                        if (data.minimum_price) {
                            $otherAmount.attr('min', theme.formatNumber(data.minimum_price, 2));
                        }
                    }).on('change keyup', function(ev){
                        $amt.val($otherAmount.val()).change();
                    });

                    if (data.minimum_price) {
                        $('<div class="minimum-price-notice w-100 mb-1 text-primary text-muted" data-minimum-price="' + theme.formatNumber(data.minimum_price, 2) + '">' +
                            'There is a minimum donation of ' + currency_symbol + theme.formatNumber(data.minimum_price, 2) +
                        '</div>').appendTo($pricingContainer);
                    }
                }

                if (data.other_amount && $otherAmount.length) {
                    $otherAmount.val(data.other_amount).change();
                    setTimeout(function() {
                        $otherAmount.focus();
                    });
                } else {
                    var $presets = $pricingContainer.find('input[name=preset_amount]'), $defaultPreset = $presets.first();

                    if (default_amt) {
                        var $defaultAmountPreset = $pricingContainer.filter('input[name=preset_amount][value="' + default_amt + '"]').first();
                        if ($defaultAmountPreset.length) {
                            $defaultPreset = $defaultAmountPreset;
                        } else if ($otherAmount.length) {
                            $defaultPreset = null;
                            $otherAmount.val(default_amt).change();
                            if ($presets.length === 0) {
                                setTimeout(function() {
                                    $otherAmount.focus();
                                });
                            }
                        }
                    }

                    if ($defaultPreset && $defaultPreset.length) {
                        $defaultPreset.prop('checked', true);
                        $defaultPreset.parents('label').addClass('active');
                        $amt.val($defaultPreset.val()).change();
                    }
                }
            } else {
                if (!hide_pricing) {
                    product_meta += ((data.on_sale) ? '<span class="line-thru text-muted font-weight-light">' + currency_symbol + theme.formatNumber(data.price) + '</span> ' + currency_symbol + theme.formatNumber(data.sale_price) : currency_symbol + theme.formatNumber(data.price));
                    product_meta += ((bill_period_short) ? '/' + bill_period_short : '');
                }

                $amt.val(data.price).change();
            }

            if (data.shipping_expectation) {
                if (data.available || data.out_of_stock_message == false) {
                    product_meta += ' <small class="d-inline-block text-muted">('+data.shipping_expectation+')</small>';
                } else {
                    product_meta += ' <small class="d-inline-block text-muted">('+data.out_of_stock_message+', '+data.shipping_expectation+')</small>';
                }
            } else if (data.available == false && data.out_of_stock_message) {
                product_meta += ' <small class="d-inline-block text-muted">('+data.out_of_stock_message+')</small>';
            }

            if (product_meta) {
                $('<div class="text-primary d-inline-block text-lg">' +
                    product_meta +
                '</div>').appendTo($pricingContainer);
            }

            $form.find('.product-recurring-day').addClass('d-none');
            $form.find('.product-recurring-weekday').addClass('d-none');
            $form.find('.product-recurring-first-payment').addClass('d-none');

            if (data.billing_period !== 'onetime') {
                if (data.first_payment) {
                    $form.find('.product-recurring-first-payment').removeClass('d-none');
                }
                if (data.billing_period === 'weekly' || data.billing_period === 'biweekly') {
                    $form.find('.product-recurring-weekday').removeClass('d-none');
                } else {
                    $form.find('.product-recurring-day').removeClass('d-none');
                }
            }
        }

        function onIsTributeChange(ev) {
            var is_tribute    = $form.find('input[name=is_tribute]:checked').val() == 1,
                $tribute_wrap = $form.find('.tribute-wrap');

            if (is_tribute) {
                $form.find('input[name=tribute_name]').prop('required', true);
                $form.find('input[name=tribute_notify][type=hidden]').val(
                    $form.find('input[name=tribute_notify][type=hidden]').data('value')
                );
                onNotificationTypeChange(ev, true);
                $tribute_wrap.collapse('show');
            } else {
                $form.find('input[name=tribute_name]').prop('required', false);
                $form.find('input[name=tribute_notify][type=hidden]').val('');
                onNotificationTypeChange(ev);
                $tribute_wrap.collapse('hide');
            }
        }

        function onNotificationTypeChange(ev, noCollapse) {
            var is_tribute        = $form.find('input[name="is_tribute"]:checked').val() == 1,
                is_hidden         = $form.find('input[name="tribute_notify"][type="hidden"]').length,
                type              = $form.find('input[name="tribute_notify"]' + (is_hidden ? '' : ':checked')).val(),
                $recipient_wrap   = $form.find('.tribute-recipient-wrap');

            if (is_tribute && type != '') {
                $form.find('input[name="tribute_notify_name"]').prop('required', true);

                if (type == 'email') {
                    $form.find('.tribute-mail').addClass('d-none');
                    $form.find('.tribute-email').removeClass('d-none');
                    $form.find('input[name="tribute_notify_email"]').prop('required', true);
                    $form.find('input[name="tribute_notify_address"]').prop('required', false);
                    $form.find('input[name="tribute_notify_city"]').prop('required', false);
                    $form.find('input[name="tribute_notify_state"]').prop('required', false);
                    $form.find('input[name="tribute_notify_zip"]').prop('required', false);
                    $form.find('input[name="tribute_notify_country"]').prop('required', false);
                } else {
                    $form.find('.tribute-email').addClass('d-none');
                    $form.find('.tribute-mail').removeClass('d-none');
                    $form.find('input[name="tribute_notify_email"]').prop('required', false);
                    $form.find('input[name="tribute_notify_address"]').prop('required', true);
                    $form.find('input[name="tribute_notify_city"]').prop('required', true);
                    $form.find('input[name="tribute_notify_state"]').prop('required', true);
                    $form.find('input[name="tribute_notify_zip"]').prop('required', true);
                    $form.find('input[name="tribute_notify_country"]').prop('required', true);
                }
                if (noCollapse === true) {
                    $recipient_wrap.addClass('show');
                } else {
                    $recipient_wrap.collapse('show');
                }
            } else {
                $form.find('input[name="tribute_notify_name"]').prop('required', false);
                $form.find('input[name="tribute_notify_email"]').prop('required', false);
                $form.find('input[name="tribute_notify_address"]').prop('required', false);
                $form.find('input[name="tribute_notify_city"]').prop('required', false);
                $form.find('input[name="tribute_notify_state"]').prop('required', false);
                $form.find('input[name="tribute_notify_zip"]').prop('required', false);
                $form.find('input[name="tribute_notify_country"]').prop('required', false);
                if (noCollapse === true) {
                    $recipient_wrap.removeClass('show');
                } else {
                    $recipient_wrap.collapse('hide');
                }
            }

            theme.bsFormResetValidation($form[0]);
        }

        // select box variants
        $form.find('select[name=variant_id]').on('change', function(ev){
            ev.preventDefault();
            if (ev.target.options.length === 1) {
                $option = $(ev.target).find('option').first();
            } else {
                $option = $(ev.target).find('option:selected');
            }
            onVariantChange($option);
        }).change();

        // radio box variants
        $form.find('input[name=variant_id]').on('change', function(ev){
            ev.preventDefault();
            $option = $form.find('input[name=variant_id]:checked');
            onVariantChange($option);
        }).first().change();

        $form.find('input[name="is_tribute"]').on('change', onIsTributeChange).change();

        $form.find('input[name="tribute_notify"]').on('change', onNotificationTypeChange).change();

        $form.find('.multi-select-required input[type=checkbox]').on('change', function(){
            var $parent = $(this).parents('.multi-select-required');
            var $inputs = $parent.find('input[type=checkbox]');
            if ($inputs.filter(':checked').length) {
                $inputs.removeAttr('required');
            } else {
                $inputs.attr('required', true);
            }
        });
    }

    $('.product-add-to-cart').each(function(i, el){
        init(el);
        $(el).bind('submit', onAddToCart);
        $(el).on('click', 'button[name=alternate-btn]', function() {
            $(el).data('redirect_to', $(this).val());
            $(el).submit();
        });
    });

    function checkValidity(form) {
        var minPriceNotice = $(form).find('.minimum-price-notice');
        if (minPriceNotice.length) {
            minPriceNotice.removeClass('has-errors');
            var amount = minPriceNotice.parents('.product-options').find('input[name=amt]').val();
            if (amount < minPriceNotice.data('minimum-price')) {
                minPriceNotice.addClass('has-errors');
            }
        }
    }


    theme.product = {
        init: init,
        checkValidity: checkValidity
    };
})(theme);
