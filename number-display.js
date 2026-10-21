/* Presentation only: never round stored values or trading inputs. */
(function(root){
  'use strict';
  const formatter=new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  function fixed(value){
    const n=Number(value);
    if(value===null||value===undefined||!Number.isFinite(n))return '—';
    return formatter.format(Math.abs(n)<0.005?0:n);
  }
  function googleData(data){
    if(root.google?.visualization?.NumberFormat){
      const f=new root.google.visualization.NumberFormat({pattern:'#,##0.00'});
      for(let col=0;col<data.getNumberOfColumns();col++)if(data.getColumnType(col)==='number')f.format(data,col);
    }
    return data;
  }
  root.GpfNumbers={fixed,googleData};
  if(root.Chart){
    root.Chart.defaults.scales.linear.ticks.format={minimumFractionDigits:2,maximumFractionDigits:2};
    root.Chart.defaults.plugins.tooltip.callbacks.label=function(ctx){
      const parsed=ctx.parsed;
      const value=typeof parsed==='number'?parsed:(ctx.chart.options.indexAxis==='y'?parsed?.x:parsed?.y);
      return (ctx.dataset.label?ctx.dataset.label+': ':'')+fixed(value??ctx.raw);
    };
  }
})(globalThis);
