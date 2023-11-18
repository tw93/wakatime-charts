const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const d3 = require('d3');
const JSDOM = require('jsdom').JSDOM;

const WAKATIME_API_KEY = process.env.INPUT_WAKATIME_API_KEY;

const createGeneratedDirectory = () => {
  process.stdout.write('Creating generated directory...');
  fs.mkdirSync(path.join(__dirname, 'generated'), { recursive: true });
  console.log('Done.');
};

const getStatsData = async () => {
  const raw_response = await fetch(
    `https://wakatime.com/api/v1/users/current/stats/last_7_days?api_key=${WAKATIME_API_KEY}`,
  );
  const response = await raw_response.json();
  console.log("response>>>>>>>>", response);
  return response.data;
};

const makeVirtualDom = () => {
  const document = new JSDOM('').window.document;
  const body = d3.select(document).select('body');

  return { document, body };
};

const drawStatsChart = (
  body,
  { data, fill, measurements = {}, isBlack = false },
) => {
  const {
    svgWidth = 540,
    svgHeight = 154,
    margin = 10,
    padding = 2,
    namesWidth = 100,
    durationsWidth = 110,
  } = measurements;

  // Measurements

  const contentWidth = svgWidth - 2 * margin;
  const contentHeight = svgHeight;

  const namesX = margin;
  const durationsX = namesX + padding + namesWidth;
  const chartX = durationsX + padding + durationsWidth;
  const chartWidth = contentWidth - chartX + margin;

  const statsY = 2;
  const statsHeight = contentHeight;

  // SVG

  const svg = body
    .append('svg')
    .attr('version', '1.1')
    .attr('xmlns', d3.namespaces.svg)
    .attr('xmlns:xlink', d3.namespaces.xlink)
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  const svgDefs = svg.append('defs');

  // Card

  svg
    .append('rect')
    .attr('width', svgWidth - 2)
    .attr('height', svgHeight - 2)
    .attr('x', 1)
    .attr('y', 1)
    .attr('rx', 4.5)
    .attr('stroke', isBlack ? '#0D1116' : '#FFFFFF')
    .attr('fill', isBlack ? '#0D1116' : '#FFFFFF')
    .attr('stroke-opacity', 1);

  // Y axis scaling

  const yScale = d3
    .scaleBand()
    .domain(data.map((datum) => datum.name))
    .range([0, statsHeight])
    .paddingInner(0.25);

  // Overflow Gradient

  const overflowGradient = svgDefs
    .append('linearGradient')
    .attr('id', 'overflowGradient');
  overflowGradient
    .append('stop')
    .attr(
      'stop-color',
      isBlack ? 'rgba(13, 17, 23, 0)' : 'rgba(254, 254, 254, 0)',
    )
    .attr('offset', '0');
  overflowGradient
    .append('stop')
    .attr(
      'stop-color',
      isBlack ? 'rgba(13, 17, 23, 0)' : 'rgba(254, 254, 254, 0)',
    )
    .attr('offset', '1');

  // Names

  svg
    .append('clipPath')
    .attr('id', 'nameClip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', namesWidth)
    .attr('height', statsHeight);

  svg
    .append('g')
    .attr('transform', `translate(${namesX}, ${statsY})`)
    .attr('width', namesWidth)
    .attr('clip-path', 'url(#nameClip)')
    .selectAll()
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'nameText')
    .attr('y', (datum) => yScale.bandwidth() / 2 + yScale(datum.name))
    .attr('dominant-baseline', 'middle')
    .attr('style', (_, i) => `animation-delay: ${500 + i * 250}ms`)
    .html((datum) => datum.name);

  svg
    .append('rect')
    .attr('transform', `translate(${namesX + namesWidth - padding}, ${statsY})`)
    .attr('width', padding)
    .attr('height', statsHeight)
    .attr('fill', 'url(#overflowGradient)');

  // Durations

  svg
    .append('clipPath')
    .attr('id', 'durationClip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', durationsWidth)
    .attr('height', statsHeight);

  svg
    .append('g')
    .attr('transform', `translate(${durationsX}, ${statsY})`)
    .attr('width', durationsWidth)
    .attr('clip-path', 'url(#durationClip)')
    .selectAll()
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'durationText')
    .attr('y', (datum) => yScale.bandwidth() / 2 + yScale(datum.name))
    .attr('dominant-baseline', 'middle')
    .attr('style', (_, i) => `animation-delay: ${600 + i * 250}ms`)
    .html((datum) => datum.text);

  svg
    .append('rect')
    .attr(
      'transform',
      `translate(${durationsX + durationsWidth - padding}, ${statsY})`,
    )
    .attr('width', padding)
    .attr('height', statsHeight)
    .attr('fill', 'url(#overflowGradient)');

  // Chart

  const chart = svg
    .append('g')
    .attr('transform', `translate(${chartX}, ${statsY})`);

  const chartDomainLimit = data.reduce(
    (max, datum) => (datum.total_seconds > max ? datum.total_seconds : max),
    0,
  );

  const chartXScale = d3
    .scaleLinear()
    .range([0, chartWidth])
    .domain([0, chartDomainLimit]);

  chart
    .selectAll()
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'durationBar')
    .attr('y', (datum) => yScale(datum.name))
    .attr('height', yScale.bandwidth())
    .attr('width', (datum) => chartXScale(datum.total_seconds))
    .attr('style', (_, i) => `animation-delay: ${700 + i * 250}ms;`)
    .attr('fill', fill);

  // Styles

  svg.append('style').html(`
    text { font: 600 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${
      isBlack ? '#c9d1d9' : '#333333'
    } }
    .nameText, .durationText { opacity: 0; animation: fadeInAnimation 0.5s ease-in-out forwards; }
    .durationBar { transform: scaleX(0); animation: scaleXInAnimation 0.5s ease-in-out forwards; }
    @keyframes fadeInAnimation {
      0%   { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes scaleXInAnimation {
      0%   { transform: scaleX(0); }
      100% { transform: scaleX(1); }
    }
`);
};

const saveChart = (body, filename) =>
  fs.writeFileSync(filename, body.node().innerHTML);

const generateLanguageStatsChart = (data) => {
  const languageColors = JSON.parse(fs.readFileSync('colors.json', 'utf-8'));

  const { body } = makeVirtualDom();

  drawStatsChart(body, {
    data: data.languages.slice(0, 5),
    fill: (datum) =>
      languageColors[datum.name] ? languageColors[datum.name].color : '#58a6ff',
  });

  saveChart(body, 'generated/wakatime_weekly_language_stats.svg');
};

const generateLanguageBlackStatsChart = (data) => {
  const languageColors = JSON.parse(fs.readFileSync('colors.json', 'utf-8'));

  const { body } = makeVirtualDom();

  drawStatsChart(body, {
    data: data.languages.slice(0, 5),
    isBlack: true,
    fill: (datum) =>
      languageColors[datum.name] ? languageColors[datum.name].color : '#58a6ff',
  });

  saveChart(body, 'generated/wakatime_weekly_language_stats_black.svg');
};

(async () => {
  createGeneratedDirectory();
  const data = await getStatsData();
  generateLanguageStatsChart(data);
  generateLanguageBlackStatsChart(data);
})();
