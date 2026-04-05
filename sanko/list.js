function getProjectSortYear(year) {
  if (typeof year === "number") return year;
  if (typeof year === "string" && year.includes("-")) {
    const parts = year.split("-");
    return parseInt(parts[1], 10) - 0.5;
  }
  return parseInt(year, 10) || 0;
}

function getProjectAssetBase(project) {
  return project.assetBase || "programs";
}

function buildProjectImagePath(project, imageName = project.cover) {
  return encodeURI(`./img/${getProjectAssetBase(project)}/${project.folder}/${imageName}`);
}

const listProjects = projectsData
  .filter((project) => !project.mapOnly)
  .map((project) => ({
  ...project,
  image: buildProjectImagePath(project),
}));

let sortAsc = false;

const tbody = document.getElementById("project-list-body");
const mainImage = document.getElementById("list-main-image");
const yearHeader = document.getElementById("year-header");
const yearArrow = document.getElementById("year-arrow");
const toMapButton = document.getElementById("list-to-map");

function renderRows() {
  const sorted = [...listProjects].sort((a, b) => {
    const diff = getProjectSortYear(a.year) - getProjectSortYear(b.year);
    return sortAsc ? diff : -diff;
  });

  tbody.innerHTML = "";

  sorted.forEach((project) => {
    const tr = document.createElement("tr");
    tr.className = "project-row";
    tr.dataset.projectId = String(project.id);

    tr.innerHTML = `
      <td class="col-year">${project.year}</td>
      <td class="col-title">${project.titleEn}</td>
      <td class="col-designer">${project.designerEn}</td>
      <td class="col-location">${project.locationEn || project.location}</td>
    `;

    tr.addEventListener("mouseenter", () => {
      if (mainImage.dataset.currentId === String(project.id)) return;
      const img = new Image();
      img.onload = () => {
        mainImage.src = project.image;
        mainImage.dataset.currentId = String(project.id);
      };
      img.src = project.image;
    });

    tr.addEventListener("click", () => {
      window.location.href = `project.html?id=${project.id}&from=fullList`;
    });

    tbody.appendChild(tr);
  });
}

if (yearHeader) {
  yearHeader.addEventListener("click", () => {
    sortAsc = !sortAsc;
    yearArrow.textContent = sortAsc ? "▲" : "▼";
    renderRows();
  });
}

if (toMapButton) {
  toMapButton.addEventListener("click", () => {
    window.location.href = "index.html#projects-section";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderRows();

  const latest = [...listProjects].sort(
    (a, b) => getProjectSortYear(b.year) - getProjectSortYear(a.year)
  )[0];

  if (latest) {
    mainImage.src = latest.image;
    mainImage.dataset.currentId = String(latest.id);
  }
});
