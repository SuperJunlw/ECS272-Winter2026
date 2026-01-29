//Create a more focused view for popular artists with at least 80 popularity to see 
// the relationship between their popularity and track popularity using a scatter plot

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

// Define the data point type for each artist
type ArtistType = {
  artist: string
  artist_popularity: number
  artist_followers: number
  avg_track_popularity: number
  explicit_rate: number // 0..1
}

export default function ScatterPlotView() {
    const [data, setData] = useState<ArtistType[]>([]) // State to store the processed data
    const scatterRef = useRef<HTMLDivElement>(null) //Referene to the div container of the scatter plot
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 }) // State to store the size of the container
    const margin: Margin = { top: 50, right: 20, bottom: 60, left: 75 }
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200) // Debounce to avoid too many re-renders

    //Observe the change of the container size
    useResizeObserver({ ref: scatterRef as React.RefObject<HTMLDivElement>, onResize });

    // Load and process data from CSV file
    useEffect(() => {
        const dataFromCSV = async () => {
            try {
                // For reading csv file and processing the variables we need for each row
                const rows = await d3.csv('../../data/spotify_data clean.csv', d => {
                    const artist = d.artist_name.trim()
                    const artist_popularity = Number(d.artist_popularity)
                    const track_popularity = Number(d.track_popularity)
                    const artist_followers = Number(d.artist_followers)
                    const expUpper = String(d.explicit ?? '').toLowerCase().trim()
                    const explicit = expUpper === 'true'

                    return { artist, artist_popularity, track_popularity, artist_followers, explicit }
            })

            // Map to aggregate data per artist
            const artistMap = new Map<string, {artist_pop: number; followers: number; sum_track: number; count: number; explicit_count: number}>()

            // Aggregate data for each artist
            for (const row of rows) {
                //Make sure the data is valid and not null
                if (!row.artist) continue
                if (!Number.isFinite(row.artist_popularity)) continue
                if (!Number.isFinite(row.track_popularity)) continue
                if (!Number.isFinite(row.artist_followers)) continue

                const prev = artistMap.get(row.artist)

                //See a new artist entry, add it to the map
                if (!prev) {
                    artistMap.set(row.artist, {
                    artist_pop: row.artist_popularity,
                    followers: row.artist_followers,
                    sum_track: row.track_popularity,
                    count: 1,
                    explicit_count: row.explicit ? 1 : 0,
                    })
                } 
                //Update the existing artist entry
                else {
                    prev.artist_pop = Math.max(prev.artist_pop, row.artist_popularity)
                    prev.followers = Math.max(prev.followers, row.artist_followers)
                    prev.sum_track += row.track_popularity
                    prev.count += 1
                    prev.explicit_count += row.explicit ? 1 : 0
                }
            }

            //Convert the map to an array of ArtistType objects
            const artists: ArtistType[] = Array.from(artistMap.entries()).map(([artist, a]) => ({
                artist,
                artist_popularity: a.artist_pop,
                artist_followers: a.followers,
                avg_track_popularity: a.sum_track / a.count,
                explicit_rate: a.explicit_count / a.count,
            }))

            //Threshold to filter popular artists
            const POP_THRESHOLD = 80
            const highPopArtists = artists.filter((d) => d.artist_popularity >= POP_THRESHOLD)

            //Set the processed data to state
            setData(highPopArtists)
            }catch (error) {
                console.error('Error loading CSV:', error)
            }
        }
        dataFromCSV();
    }, [])

    // Re-render the chart when data or size changes
    useEffect(() => {
        if (isEmpty(data)) return
        if (size.width === 0 || size.height === 0) return

        d3.select('#scatter-svg').selectAll('*').remove()
        initChart()
    }, [data, size])

    // Initialize and draw the scatter plot
    function initChart() {

        // Select the svg tag so that we can insert elements within it
        let chartContainer = d3.select('#scatter-svg')

        // get the max popularity on the X-axis 
        let xMax = d3.max(data, d => d.artist_popularity) ?? 0

        // get the extent of average track popularity on the Y-axis
        let yExtent = d3.extent(data, (d) => d.avg_track_popularity) as [number, number]

        // Jitter to avoid overplotting, so points don't overlap exactly
        let jitter = 6 // pixels

        // Define scales for x and y axes
        let xScale = d3
            .scaleLinear()
            .domain([78, xMax])
            .range([margin.left, size.width - margin.right])

        let yScale = d3
            .scaleLinear()
            .domain(yExtent)
            .range([size.height - margin.bottom, margin.top])

        // Define color scale for explicit content rate
        const color = d3.scaleSequential((t) =>
            d3.interpolateBlues(0.3 + 0.7 * t)).domain([0, 1])

        // Draw axes
        const xAxis = chartContainer
            .append('g')
            .attr('transform', `translate(0, ${size.height - margin.bottom})`)
            .call(d3.axisBottom(xScale))

        const yAxis = chartContainer
            .append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale))

        // Add axis labels 
        const xLabel = chartContainer.append('g')
            .append('text')
            .attr('x', size.width / 2)
            .attr('y', size.height - 12)
            .style('text-anchor', 'middle')
            .style('font-size', '.9rem')
            .text('Artist Popularity')

        const yLabel = chartContainer.append('g')
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(size.height / 2))
            .attr('y', 40)
            .style('text-anchor', 'middle')
            .style('font-size', '.9rem')
            .text('Average Track Popularity (per artist)')

        // Chart title
        const title = chartContainer.append('g')
            .append('text')
            .attr('x', size.width / 2)
            .attr('y', margin.top / 2)
            .style('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .style('font-size', '1rem')
            .text('Top Artist Popularity (>= 80) vs Avg Track Popularity')

        // Draw points
        const points = chartContainer
            .append('g')
            .selectAll('circle')
            .data(data)
            .join('circle')
            // specify the coordinates of the points and add jittering to avoid overplotting
            .attr('cx', d => xScale(d.artist_popularity) + (Math.random() - 0.5) * jitter)
            .attr('cy', d => yScale(d.avg_track_popularity) + (Math.random() - 0.5) * jitter)
            .attr('r', 3.5)
            // Fill color based on explicit content rate
            .attr('fill', (d) => color(d.explicit_rate))
            //Add some transparency to help see overlapping points
            .attr('opacity', 0.9)
            // Add stroke to each point
            .attr('stroke', '#1f3b73')
            .attr('stroke-width', 0.4)

        // Lengend for explicit content rate
        let legendWidth = 120
        let legendHeight = 10
        let legendX = size.width - margin.right - legendWidth
        let legendY = size.height - margin.bottom - legendHeight - 30

        // Define gradient for legend
        const defs = chartContainer.append('defs')
        const gradId = 'explicitRateGradient'
        const gradient = defs
            .append('linearGradient')
            .attr('id', gradId)
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%')

        // Create gradient stops
        d3.range(0, 1.0001, 0.1).forEach((t) => {
            gradient
            .append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', color(t))
        })

        // Draw legend rectangle
        const legend = chartContainer
            .append('rect')
            .attr('x', legendX)
            .attr('y', legendY)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('fill', `url(#${gradId})`)
            .attr('stroke', '#999')

        // Add legend labels
        const noExplicit = chartContainer
            .append('text')
            .attr('x', legendX - 25)
            .attr('y', legendY + legendHeight + 14)
            .style('font-size', '.75rem')
            .text('0% explicit')

        const allExplicit = chartContainer
            .append('text')
            .attr('x', legendX + legendWidth + 20)
            .attr('y', legendY + legendHeight + 14)
            .style('font-size', '.75rem')
            .style('text-anchor', 'end')
            .text('100% explicit')

        const legendLabel = chartContainer
            .append('text')
            .attr('x', legendX + legendWidth / 2)
            .attr('y', legendY - 6)
            .style('font-size', '.8rem')
            .style('text-anchor', 'middle')
            .text('Explicit Content Rate')
    }
    return (
        <>
            <div ref={scatterRef} className='chart-container'>
                <svg id='scatter-svg' width='100%' height='100%'></svg>
            </div>
        </>
    )
}
