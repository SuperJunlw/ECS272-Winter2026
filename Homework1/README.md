# Homework 1: Static Visualizations with Observable Notebook
In this homework, you will practice visualization design and reasoning using [Observable Notebook](https://observablehq.com/platform/notebooks). 

This assignment focuses on:
 - asking clear questions of data,
 - choosing appropriate visualization types and visual encodings,
 - and extracting meaningful insights about data through visualization design.

## Step 0: Setting Up Observable
Observable introduces the notebook paradigm to JavaScript projects. If you are familiar with Jupyter notebooks, this is similar, but uses JavaScript instead of Python. 

Before you begin, create an account at [Observable Notebook](https://observablehq.com/platform/notebooks) by clicking on sign in. \
After logging in, you can then create a new blank notebook. 
To do so, click the icon next to your profile picture in the top right-hand corner of the page. The icon will be to the left of your profile picture.

Note that we will be using Observable Notebook in workshops.

* [Quick Observable Tutorial](https://observablehq.com/@observablehq/a-taste-of-observable) 
* [Observable Notebook Documentation](https://observablehq.com/documentation/notebooks/)
* [AI assist on Observable](https://observablehq.com/documentation/ai-assist/)
* If you need to learn more about JavaScript, you can refer to [A re-introduction to JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/A_re-introduction_to_JavaScript)

## Step 1: Choose a Dataset from the Following List
Each of the following datasets can be downloaded as CSV files.

* [World Top Restaurants](https://www.kaggle.com/datasets/shaistashahid/world-top-resturants)
* [TV Show Ratings](https://www.kaggle.com/datasets/raveennimbiwal/top-rated-tv-shows-dataset-global-2025)
* [Future Jobs and Skills Demand](https://www.kaggle.com/datasets/ahsanneural/future-jobs-and-skills-demand-2025)
* [Coffee Sales](https://www.kaggle.com/datasets/navjotkaushal/coffee-sales-dataset)
* [CO2 Emission Around the World](https://www.kaggle.com/datasets/koustavghosh149/co2-emission-around-the-world)
* ~~[Global Disaster Response](https://www.kaggle.com/datasets/zubairdhuddi/global-daset)~~ (invalid geospatial data)


Please follow [this tutorial](https://observablehq.com/@observablehq/a-taste-of-observable#cell-1352) to load your data into the notebook. 

## Step 2: Design Brief
Before creating any visualizations, add a Markdown cell to clearly state:

 1. Analysis questions about the data 
    - State 2 or 3 specific and concrete questions you want to explore through visualization.
    - These questions should be answerable through visualization, focus on data patterns, and not be vague (avoid "explore the data")
    - You may also briefly describe your expected findings, if you have any. 
    - The following are examples of the level of specificity expected, for guidance only:
        - Are there noticeable differences between subsets of the data? If so, how are they different?
        - What relationships appear between two or more variables?
        - Are there trends or changes over time? Any variables that may drive this pattern?

 2.	Intended audience \
Who may benefit from these analysis questions and the designed visualizations?
e.g., general public, policy makers, analysts, students

This section will be graded and **should guide all design decisions** that follow. \
Note that these questions are meant to guide your design, not to restrict it. You may refine or combine them as you work.

## Step 3: Process, Design, Visualize, and Reflect
Once your chosen dataset is loaded into the Observable notebook, design and create at least three static visualizations that address the questions stated in your design brief.

For data processing, vanilla JavaScript should be sufficient. However, feel free to use any Javascript library for processing and analyzing the data. 


### Requirements

Your notebook should integrate visualizations and text into a coherent report.
Use markdown cells to explain your design decisions, insights, and reflection. The report can be structured in the following order.

 - A design brief described in Step 2.
 - Create at least three static visualizations.
 - All analysis questions should be addressed by your visualizations collectively or individually.
 - Pick different methods for each visualization. (see the list below)
    - The purpose is to explore how different aspects of the data are highlighted 
    - For example, creating a bar chart and a histogram only counts as using only one method, since their implementation is nearly the same.
 - For each visualization, include a short explanation describing:
    - which analysis question(s) it supports,
	- why this visualization method is appropriate,
	- whether other visualization methods could also be reasonable
 - Provide at least two meaningful insights supported by your visualizations
    - Insights should go beyond obvious restatements of the data, i.e., you wouldn't have noticed by staring at a CSV file.
    - Insights may be supported by one visualization or by looking at multiple visualizations side by side. 
 - Include a brief reflection that addresses one of the following:
    - a design decision you are uncertain about
    - a visualization method you considered but did not include
    - what would you improve or change with more time

### Programming Requirement

All visualizations must be implemented using D3.js (please use v7) or [Observable Plot](https://observablehq.com/@observablehq/plot-gallery).\
Observable Plot allows you to visualize data in an efficient manner on Observable.

Observable Plot is allowed only in this homework.\
**We encourage you to use D3.js to create visualizations, as D3.js is required for future homework and the final project.**

### Important Notes

 - There is no required one-to-one mapping between questions and visualizations.
	 - One visualization may support multiple questions.
	 - Multiple visualizations may help explore the same question.
 - In this assignment, you will not be penalized for imperfect visualization choices if your reasoning is clear and thoughtful.

---

### Examples of Visualization Methods

**Fundamental**
* Bar chart or histogram
* Pie or donut chart
* Line and area chart
* 2D heatmap or matrix view
* Scatter plot
* Node-link diagram
* Geographical map

**Advanced**
* Parallel set or parallel coordinates plot
* Sankey or alluvial diagram
* Star coordinates or plot
* Chord diagram
* Stream graph
* Arc diagram
* Dendrogram

### Important tutorials to D3.js (recommended)

 - Essentials: [HTML & CSS & D3](https://d3-graph-gallery.com/intro_d3js.html), [Margin Convention](https://observablehq.com/@d3/margin-convention), [Selection](https://www.d3indepth.com/selections/), [Data Joins](https://www.d3indepth.com/datajoins/)
 - [An example notebook](https://observablehq.com/d/5313c1de57b3125c) using D3.js and Observable plot
    - You may refer to this notebook; however, if you submit this exact visualization and analysis you will not receive any credit.


## Submission
Enable link sharing for your Observable notebook. \
Make sure the notebook visibility is set to public.\
Submit the notebook link to HW1 on Canvas.