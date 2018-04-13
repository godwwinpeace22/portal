$(function(){

    $('.button').on('click', function(){
        window.print();
        //alert()
    })

    // sort members
    $('.filter select').change(function(e){
        console.log($(this).val() +' '+ $(this).prop('name'))
        var baseurl = location.href.split('?')[0]
        location.href = baseurl + '?' + 'sortby=' + $(this).prop('name') +'&sortval=' + $(this).val()
    })
})
