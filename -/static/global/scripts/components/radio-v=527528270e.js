Vue.component('radio-group', {
    props: {
        name: {
            type: String,
            required: true
        },
        value: {
            required: true
        }
    },
    data: function () {
        return {
            chosenValue: null
        }
    },
    methods: {
        clickButton: function () {
            this.value = this.radioValue;
            this.$emit('input', this.radioValue);
        }
    },
    computed: {
        selected: function () {
            //return this.radioValue == this.value;
        }
    },
    template: '<label class="btn btn-lg btn-outline-primary mb-1 mr-1" @click="clickButton"> <input type="radio" :name="name" :selected="selected" :value="radioValue"><slot></slot></label>'
});