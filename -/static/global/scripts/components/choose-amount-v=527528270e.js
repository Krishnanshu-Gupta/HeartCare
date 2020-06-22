var template = '';

template += '<div v-if="presets && presets.length > 0" class="btn-group-toggle form-primary d-inline-block price-presets">';
template += '    <template v-for="(price, index) in presets">';
template += '        <div :key="price" v-if="price == \'other\'" class="form-group d-inline-block mb-1 mr-1 labelify bs-validate">';
template += '            <label>Other</label>';
template += '            <input style="width:120px;" v-model="enteredAmount" type="number" @input="updateAmount($event)" @focus="focusAmountField($event)" step="0.01" class="font-weight-bold form-control form-control-outline" name="other_amount" value="">';
template += '        </div>';
// template += '        <radio v-else name="preset_amount" @input="clickRadio($event)" :radio-value="price">{{ currencySymbol }}{{ price }}</radio>';
template += '        <div v-else class="btn btn-lg btn-outline-primary mb-1 mr-1" :class="{ active: (price == amount && enteredAmount == \'\') }" @click="clickRadio(price)"> {{ currencySymbol }}{{ price }}</div>';
template += '    </template>';
template += '</div>';
template += '<div v-else class="form-group d-inline-block mb-1 mr-1 labelify bs-validate">';
template += '    <label>Amount</label>';
template += '    <input style="width:170px;" v-model="enteredAmount" type="number" @input="updateAmount($event)" @focus="focusAmountField($event)" step="0.01" class="form-control form-control-outline" name="other_amount" value="" >';
template += '</div>';

Vue.component('choose-amount', {
    props: {
        presets: {
            type: Array,
            required: false,
            default: []
        },
        value: {
            type: Number,
            required: false,
            default: 0
        }
    },
    template: template,
    data: function () {
        return {
            amount: 0,
            enteredAmount: '',
            currencySymbol: Givecloud.config.currency.symbol,
            updateAmountTimeoutId: null
        }
    },
    mounted: function () {
        this.amount = this.value;
    },
    methods: {
        clickRadio: function (amount) {
            this.enteredAmount = '';
            this.amount = amount;
        },
        updateAmount: function ($event) {
            this.enteredAmount = $event.target.value;
            this.amount = $event.target.value;
        },
        focusAmountField: function ($event) {
            $event.target.select();
        }
    },
    watch: {
        amount: function (amount) {
            this.$emit('input', amount);
        }
    }
});
