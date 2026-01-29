//Create overall view of the popularity of artists using a bar chart

import React from 'react'
import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { isEmpty } from 'lodash';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';

import { Bar, ComponentSize, Margin } from '../types';

// A "extends" B means A inherits the properties and methods from B.
interface CategoricalBar extends Bar{
  category: string;
}

export default function BarView() {
  const [bars, setBars] = useState<CategoricalBar[]>([]);
  const barRef = useRef<HTMLDivElement>(null); //Referene to the div container of the bar chart
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 }); // State to store the size of the container
  const margin: Margin = { top: 40, right: 20, bottom: 80, left: 60 };
  const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200) // Debounce to avoid too many re-renders

  //Observe the change of the container size
  useResizeObserver({ ref: barRef as React.RefObject<HTMLDivElement>, onResize });
  
  // Load and process data from CSV file
  useEffect(() => {
    // For reading csv file
    const dataFromCSV = async () => {
      try {
        const rows = await d3.csv('../../data/spotify_data clean.csv', d => {
          // This callback allows you to rename the keys, format values, and drop columns you don't need
          return {category: d.artist_name, value: +d.artist_popularity};
        });

        const artistVsPop = new Map<string, number>(); // Map to store unique artists and their popularity

        //Go through each row and populate the map, only keep the maximum popularity for each artist
        for (const row of rows) {
          const a_name = (row.category ?? '').trim()
          if(!a_name) continue
          const a_pop = row.value

          const prev = artistVsPop.get(a_name)

          //The popularity of an artist should be the same across different songs so just keep the maximum
          if(prev === undefined || a_pop > prev) {
            artistVsPop.set(a_name, a_pop)
          }
        }

        // Create the spec ofbins for artist popularity ranges
        const createBucket = d3
           .bin<number, number>()
           .domain([0, 100])
           .thresholds(d3.range(0, 100, 10)) //buckets of size 10  
           .value(d => d)
        
        // Generate the actual bins using artist popularity values
        const bins = createBucket(Array.from(artistVsPop.values()))

        // Create the CategoricalBar array from the bins
        const createdBars: CategoricalBar[] = bins.map((b) => {
          const x0 = b.x0 ?? 0
          const x1 = b.x1 ?? 0
          return {
            category: `${x0}-${x1}`, //category label as a range string, like "0-10"
            value: b.length //number of artists in this bin
          }
        })

        setBars(createdBars);

      } catch (error) {
        console.error('Error loading CSV:', error);
      }
    } 
    dataFromCSV();
  }, [])

  // Re-render the chart when data or size changes
  useEffect(() => {
    if (isEmpty(bars)) return;
    if (size.width === 0 || size.height === 0) return;

    d3.select('#bar-svg').selectAll('*').remove();

    initChart();
  }, [bars, size])

  // Initialize and draw the bar chart
  function initChart() {
    // select the svg tag so that we can insert elements, i.e., draw the chart, within it.
    let chartContainer = d3.select('#bar-svg')

    // Get the maximum y value for scaling
    let yMax = d3.max(bars, (d) => d.value as number) ?? 0
    
    // x-axis categories
    let xCategories: string[] = bars.map((d) => d.category)

    // Define scales for x axis using the categories
    let xScale = d3
      .scaleBand()
      .rangeRound([margin.left, size.width - margin.right])
      .domain(xCategories)
      .padding(0.1) // spacing between the categories

    // Define scales for y axis using the maximum y value
    let yScale = d3
      .scaleLinear()
      .range([size.height - margin.bottom, margin.top]) //bottom side to the top side on the screen
      .domain([0, yMax]) 

    // Draw x axis
    let xAxis = chartContainer
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale))

    // Draw y axis
    let yAxis = chartContainer
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale))

    // Add axis labels
    let yLabel = chartContainer.append('g')
      .append('text')
      .attr('x', -(size.height / 2))
      .attr('y', margin.left / 2.2)
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Number of Artists (unique artists)')

    let xLabel = chartContainer.append('g')
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', size.height - 40)
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Artist Popularity (10-point ranges)')
    
    // "g" is grouping element that does nothing but helps avoid DOM looking like a mess
    // We iterate through each <CategoricalBar> element in the array, create a rectangle 
    // for each and indicate the coordinates, the rectangle, and the color.
    let chartBars = chartContainer.append('g')
      .selectAll('rect')
      .data<CategoricalBar>(bars) 
      .join('rect')
      // specify the left-top coordinate of the rectangle
      .attr('x', (d: CategoricalBar) => xScale(d.category) as number)
      .attr('y', (d: CategoricalBar) => yScale(d.value) as number)
      // specify the size of the rectangle
      .attr('width', xScale.bandwidth())
      .attr('height', (d: CategoricalBar) => Math.abs(yScale(0) - yScale(d.value))) // this substraction is reversed so the result is non-negative
      .attr('fill', 'lightgrey')
    
    // Chart title
    let title = chartContainer.append('g')
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', margin.top / 2)
      .style('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('font-size', '1rem')
      .text('Spotify Artist Popularity Distribution (2009 - 2025)')    
  }

  return (
    <>
      <div ref={barRef} className='chart-container'>
        <svg id='bar-svg' width='100%' height='100%'></svg>
      </div>
    </>
  )
}
